import type { CodexClient } from '@irc/llm';
import type { ConversationRepository } from '@irc/db';
import type { ToolGateway } from '@irc/tools';
import type { Brain, BrainContext, AgentExecutorLike } from './brain.js';

export interface CodexBrainOptions {
  client: CodexClient;
  gateway: ToolGateway;
  conversations: ConversationRepository;
  workspace: string;
  systemPrompt?: string;
  maxToolIterations?: number;
}

const TOOL_LINE = /^IRC_TOOL:\s*(\{.*\})\s*$/;

export const CODEX_TOOL_INSTRUCTIONS = [
  'You have external workspace tools:',
  '  list_files -> input: { path? }',
  '  read_file -> input: { path }',
  '  write_file -> input: { path, content }',
  '  git_status -> input: {}',
  '  git_diff -> input: { staged? }',
  '  run_verification -> input: { command }',
  '    command must be one of: "npm test", "npm run test:ts", "npm run typecheck", "docker compose config --quiet"',
  '',
  'You also have an external tool to manage IRC agents in the control-plane database:',
  '  manage_agents -> input: { action: "list" | "create" | "update", id?, nick?, role?, context?, skills? }',
  '  (create needs id, nick, role, context; choose skills from: implementation,tdd,repo-editing; qa,testing,review; orchestration,planning,routing; research,docs,context; ops,logs,diagnostics).',
  '',
  'To call a tool, emit exactly one line in this format and stop:',
  '  IRC_TOOL: {"tool":"read_file","input":{"path":"README.md"}}',
  'The system will reply with TOOL_RESULT and you then give the final answer.',
  'Use read tools when the user asks about repo files, docs, git state, or current implementation.',
  'For implementation tasks, read the relevant files, update tests first with IRC_TOOL write_file, run verification, then update production files.',
  'Do not answer that you are read-only when IRC_TOOL write_file is advertised; attempt the tool call and report only actual tool denial.',
  'Keep hand-written files at or below 200 lines and avoid unrelated refactors.',
  'Use manage_agents when the user asks to create, list, or update agents.',
].join('\n');

const DEFAULT_SYSTEM_PROMPT = [
  'You are the orchestrator of an IRC-based multi-agent control plane.',
  'You answer IRC users. Keep replies concise (a few short lines).',
  '',
  CODEX_TOOL_INSTRUCTIONS,
].join('\n');

export class CodexBrain implements Brain {
  private readonly options: Required<Omit<CodexBrainOptions, 'systemPrompt'>> & {
    systemPrompt: string;
  };

  constructor(options: CodexBrainOptions) {
    this.options = {
      client: options.client,
      gateway: options.gateway,
      conversations: options.conversations,
      workspace: options.workspace,
      systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      maxToolIterations: options.maxToolIterations ?? 8,
    };
  }

  async respond(prompt: string, context: BrainContext): Promise<string> {
    const existing = this.options.conversations.findThread(context.contextKey);
    const threadId = existing?.threadId;

    const framed = `${this.options.systemPrompt}\n\nWorkspace: ${this.options.workspace}\n\nUser request: ${prompt}`;
    const originalRequest = prompt;
    let currentPrompt = framed;
    let lastText = '';
    let activeThread = threadId;

    for (let iteration = 0; iteration < this.options.maxToolIterations; iteration++) {
      const result = await this.generateTurn(currentPrompt, activeThread);
      activeThread = result.threadId;
      lastText = result.text;

      const toolCall = parseToolCall(lastText);
      if (!toolCall) {
        this.persist(context.contextKey, activeThread);
        return clean(lastText);
      }

      const toolResult = await this.options.gateway.execute(toolCall.tool, toolCall.input);
      currentPrompt = [
        `Original request: ${originalRequest}`,
        `You called ${toolCall.tool} with ${JSON.stringify(toolCall.input)}.`,
        `TOOL_RESULT: ${JSON.stringify(toolResult)}`,
        'If more tool work is needed, emit another IRC_TOOL line and stop.',
        'Otherwise give the final concise answer to the user.',
      ].join('\n');
    }

    this.persist(context.contextKey, activeThread);
    return clean(lastText) || '(no answer)';
  }

  private persist(contextKey: string, threadId: string | undefined): void {
    if (threadId) this.options.conversations.saveThread(contextKey, threadId);
  }

  private async generateTurn(prompt: string, threadId: string | undefined): Promise<{ threadId: string; text: string }> {
    try {
      return await this.options.client.generate({ prompt, threadId });
    } catch (error) {
      if (!threadId || !isMissingThread(error)) throw error;
      return this.options.client.generate({ prompt });
    }
  }
}

interface ParsedToolCall {
  tool: string;
  input: Record<string, unknown>;
}

export function parseToolCall(text: string): ParsedToolCall | null {
  for (const line of text.split('\n')) {
    const match = line.match(TOOL_LINE);
    if (!match || match[1] === undefined) continue;
    try {
      const parsed = JSON.parse(match[1]) as { tool?: string; input?: unknown };
      if (parsed.tool && parsed.input && typeof parsed.input === 'object') {
        return { tool: parsed.tool, input: parsed.input as Record<string, unknown> };
      }
    } catch {
      // malformed tool line — ignore and keep scanning
    }
  }
  return null;
}

function clean(text: string): string {
  return text
    .split('\n')
    .filter((line) => !TOOL_LINE.test(line))
    .join('\n')
    .trim();
}

function isMissingThread(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread not found/i.test(message);
}

export type { Brain, BrainContext, AgentExecutorLike } from './brain.js';
