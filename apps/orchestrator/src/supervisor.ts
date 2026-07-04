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

/**
 * The lifecycle surface the supervisor needs from a running agent. `AgentBot`
 * satisfies this structurally; tests inject fakes that record start/stop.
 */
export interface AgentHandle {
  readonly nick: string;
  start(): void;
  stop(): void;
  assignTaskChannel(task: { id: string; title: string; channel: string }): void;
}

export type BotFactory = (options: AgentBotOptions) => AgentHandle;

export interface ReconcileResult {
  started: string[];
  stopped: string[];
  unchanged: number;
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
  /** Inject a custom bot factory (testing). Defaults to a real `AgentBot`. */
  createBot?: BotFactory;
}

/**
 * Owns the running IRC presence of created agents. Spawning is idempotent per
 * nick so repeated create calls (or restarts) do not double-connect an agent.
 * `reconcile()` keeps the running set in sync with the `agents` table, starting
 * new agents and stopping deleted ones.
 */
export class AgentSupervisor {
  private readonly bots = new Map<string, AgentHandle>();
  private readonly reserved: Set<string>;
  private readonly createBot: BotFactory;

  constructor(private readonly deps: SupervisorDeps) {
    this.reserved = new Set((deps.reservedNicks ?? []).map((nick) => nick.toLowerCase()));
    this.createBot = deps.createBot ?? ((options) => new AgentBot(options));
  }

  isRunning(nick: string): boolean {
    return this.bots.has(nick.toLowerCase());
  }

  runningNicks(): string[] {
    return [...this.bots.values()].map((bot) => bot.nick);
  }

  spawn(agent: AgentSummary, channels: string[], greetChannel?: string): AgentHandle | null {
    const key = agent.nick.toLowerCase();
    if (this.bots.has(key)) return this.bots.get(key)!;
    if (this.reserved.has(key)) return null;

    const bot = this.createBot({
      host: this.deps.host,
      port: this.deps.port,
      agent,
      channels: dedupe([...channels, '#agents']),
      greetChannel,
      codex: this.deps.codex,
      conversations: this.deps.conversations,
      gateway: this.deps.gateway,
      workspace: this.deps.workspace,
    });

    bot.start();
    this.bots.set(key, bot);
    return bot;
  }

  /** Stop a running agent by nick. Returns true if a bot was stopped. */
  stop(nick: string): boolean {
    const key = nick.toLowerCase();
    const bot = this.bots.get(key);
    if (!bot) return false;
    bot.stop();
    this.bots.delete(key);
    return true;
  }

  assignTaskChannel(nick: string, task: { id: string; title: string; channel: string }): boolean {
    const bot = this.bots.get(nick.toLowerCase());
    if (!bot) return false;
    bot.assignTaskChannel(task);
    return true;
  }

  /**
   * Bring the running set in sync with `agents`: start agents present in the
   * list but not running, and stop agents running but no longer listed (e.g.
   * deleted via BotService). Idempotent and safe to call repeatedly.
   */
  reconcile(agents: AgentSummary[], channels: string[], greetChannel?: string): ReconcileResult {
    const desired = new Map<string, AgentSummary>();
    for (const agent of agents) desired.set(agent.nick.toLowerCase(), agent);

    const started: string[] = [];
    let unchanged = 0;
    for (const agent of agents) {
      const key = agent.nick.toLowerCase();
      if (this.reserved.has(key)) continue;
      if (this.bots.has(key)) {
        unchanged++;
        continue;
      }
      this.spawn(agent, channels, greetChannel);
      started.push(agent.nick);
    }

    const stopped: string[] = [];
    for (const [key, bot] of this.bots) {
      if (desired.has(key)) continue;
      bot.stop();
      this.bots.delete(key);
      stopped.push(bot.nick);
    }

    return { started, stopped, unchanged };
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
