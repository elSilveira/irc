import type { CodexClient } from '@irc/llm';
import type { ConversationRepository } from '@irc/db';
import type { ToolGateway } from '@irc/tools';
import { AgentBot, type AgentBotOptions } from './agent-bot.js';

export interface AgentSummary {
  id: string;
  nick: string;
  role: string;
  context: string;
}

export interface SupervisorDeps {
  host: string;
  port: number;
  codex: CodexClient;
  conversations: ConversationRepository;
  gateway: ToolGateway;
  workspace: string;
  /** Nicks that must never be spawned as agents (e.g. the orchestrator itself). */
  reservedNicks?: string[];
}

/**
 * Owns the running IRC presence of created agents. Spawning is idempotent per
 * nick so repeated create calls (or restarts) do not double-connect an agent.
 */
export class AgentSupervisor {
  private readonly bots = new Map<string, AgentBot>();
  private readonly reserved: Set<string>;

  constructor(private readonly deps: SupervisorDeps) {
    this.reserved = new Set((deps.reservedNicks ?? []).map((nick) => nick.toLowerCase()));
  }

  isRunning(nick: string): boolean {
    return this.bots.has(nick.toLowerCase());
  }

  spawn(agent: AgentSummary, channels: string[], greetChannel?: string): AgentBot | null {
    const key = agent.nick.toLowerCase();
    if (this.bots.has(key)) return this.bots.get(key)!;
    if (this.reserved.has(key)) return null;

    const options: AgentBotOptions = {
      host: this.deps.host,
      port: this.deps.port,
      agent,
      channels: dedupe([...channels, '#agents']),
      greetChannel,
      codex: this.deps.codex,
      conversations: this.deps.conversations,
      gateway: this.deps.gateway,
      workspace: this.deps.workspace,
    };

    const bot = new AgentBot(options);
    bot.start();
    this.bots.set(key, bot);
    return bot;
  }

  spawnAll(agents: AgentSummary[], channels: string[]): AgentBot[] {
    return agents
      .map((agent) => this.spawn(agent, channels))
      .filter((bot): bot is AgentBot => bot !== null);
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
