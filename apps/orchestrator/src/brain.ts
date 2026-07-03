import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import type { AgentRuntime } from '@irc/llm';
import type { ToolGateway } from '@irc/tools';

export interface BrainContext {
  /** Stable key used to persist provider threads/memory per conversation. */
  contextKey: string;
  sender?: string;
  channel?: string;
}

export interface Brain {
  respond(prompt: string, context: BrainContext): Promise<string>;
}

export interface LangChainBrainOptions {
  runtime: AgentRuntime;
  gateway: ToolGateway;
  systemPrompt?: string;
  /** Override the agent factory for testing. */
  buildExecutor?: (model: unknown, gateway: ToolGateway, systemPrompt: string) => AgentExecutorLike | Promise<AgentExecutorLike>;
}

export interface AgentExecutorLike {
  invoke(input: { input: string }): Promise<{ output?: string }>;
}

const DEFAULT_SYSTEM_PROMPT = [
  'You are the orchestrator of an IRC-based multi-agent control plane.',
  'You can read the workspace (list/read files, git status/diff) and manage agents globally (create/list/update).',
  'You cannot run shell, edit files, push git, or deploy — those stay blocked and require human approval.',
  'Be concise. Prefer a tool call when the user asks about the workspace or agents.',
].join(' ');

export class LangChainBrain implements Brain {
  private readonly options: LangChainBrainOptions;
  private executorPromise?: Promise<AgentExecutorLike>;

  constructor(options: LangChainBrainOptions) {
    this.options = options;
  }

  async respond(prompt: string, _context: BrainContext): Promise<string> {
    const executor = await this.ensureExecutor();
    const result = await executor.invoke({ input: prompt });
    return result.output ?? '(no output)';
  }

  private async ensureExecutor(): Promise<AgentExecutorLike> {
    if (!this.executorPromise) {
      this.executorPromise = this.buildExecutor().catch((error) => {
        this.executorPromise = undefined;
        throw error;
      });
    }
    return this.executorPromise;
  }

  private async buildExecutor(): Promise<AgentExecutorLike> {
    const systemPrompt = this.options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const buildExecutor = this.options.buildExecutor ?? defaultBuildExecutor;
    const model = this.options.runtime.getToolCapableModel();
    return buildExecutor(model, this.options.gateway, systemPrompt);
  }
}

async function defaultBuildExecutor(
  model: unknown,
  gateway: ToolGateway,
  systemPrompt: string,
): Promise<AgentExecutorLike> {
  const { toLangChainTools } = await import('@irc/tools');
  const { createReactAgent, AgentExecutor } = await import('langchain/agents');

  const tools = toLangChainTools(gateway);
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createReactAgent({ llm: model as never, tools: tools as never, prompt });
  return new AgentExecutor({ agent, tools: tools as never });
}

export function buildSystemPrompt(extra?: string): string {
  return extra ? `${DEFAULT_SYSTEM_PROMPT}\n${extra}` : DEFAULT_SYSTEM_PROMPT;
}
