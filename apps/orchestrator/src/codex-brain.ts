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
  'You have external read-only workspace tools:',
  '  list_files -> input: { path? }',
  '  read_file -> input: { path }',
  '  git_status -> input: {}',
  '  git_diff -> input: { staged? }',
  '',
  'You also have an external tool to manage IRC agents in the control-plane database:',
  '  manage_agents -> input: { action: "list" | "create" | "update", id?, nick?, role?, context? }',
  '  (create needs id, nick, role, context; update needs id plus role and/or context).',
  '',
  'To call a tool, emit exactly one line in this format and stop:',
  '  IRC_TOOL: {"tool":"read_file","input":{"path":"README.md"}}',
  'The system will reply with TOOL_RESULT and you then give the final answer.',
  'Use read tools when the user asks about repo files, docs, git state, or current implementation.',
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
      maxToolIterations: options.maxToolIterations ?? 3,
    };
  }

  async respond(prompt: string, context: BrainContext): Promise<string> {
    const existing = this.options.conversations.findThread(context.contextKey);
    const threadId = existing?.threadId;

    const framed = `${this.options.systemPrompt}\n\nWorkspace: ${this.options.workspace}\n\nUser request: ${prompt}`;
    let currentPrompt = framed;
    let lastText = '';
    let activeThread = threadId;

    for (let iteration = 0; iteration < this.options.maxToolIterations; iteration++) {
      const result = await this.options.client.generate({ prompt: currentPrompt, threadId: activeThread });
      activeThread = result.threadId;
      lastText = result.text;

      const toolCall = parseToolCall(lastText);
      if (!toolCall) {
        this.persist(context.contextKey, activeThread);
        return clean(lastText);
      }

      const toolResult = await this.options.gateway.execute(toolCall.tool, toolCall.input);
      currentPrompt = `You called ${toolCall.tool} with ${JSON.stringify(toolCall.input)}.\nTOOL_RESULT: ${JSON.stringify(toolResult)}\nNow give the final concise answer to the user.`;
    }

    this.persist(context.contextKey, activeThread);
    return clean(lastText) || '(no answer)';
  }

  private persist(contextKey: string, threadId: string | undefined): void {
    if (threadId) this.options.conversations.saveThread(contextKey, threadId);
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

export type { Brain, BrainContext, AgentExecutorLike } from './brain.js';
