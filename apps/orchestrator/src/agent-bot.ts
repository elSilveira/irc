import type { CodexClient } from '@irc/llm';
import type { ConversationRepository } from '@irc/db';
import type { ToolGateway } from '@irc/tools';
import { CodexBrain } from './codex-brain.js';
import type { Brain } from './brain.js';
import { IrcClient, nickFromPrefix, type ParsedLine } from './irc.js';
import { ensureChainRef } from './conversation-chain.js';
import { buildAgentSystemPrompt, buildAgentTurn } from './agent-turn.js';
import { ensureTaskProtocolOutput } from './agent-task-output.js';
export { buildAgentSystemPrompt, buildAgentTurn } from './agent-turn.js';

export interface AgentBotOptions {
  host: string;
  port: number;
  agent: { id: string; nick: string; role: string; context: string; skills?: string };
  /** Channels the agent should join. */
  channels: string[];
  /** Channel where the agent posts its online greeting. Defaults to channels[0]. */
  greetChannel?: string;
  codex: CodexClient;
  conversations: ConversationRepository;
  gateway: ToolGateway;
  workspace: string;
  brain?: Brain;
  taskHeartbeatMs?: number;
}

/**
 * A created agent brought to life on IRC. Connects under the agent nick, joins
 * its channels, announces itself, and answers DMs and @mentions by relaying to
 * Codex with one persisted thread per (agent, context).
 */
export class AgentBot {
  readonly nick: string;
  private readonly options: AgentBotOptions;
  private readonly brain: Brain;
  private irc?: IrcClient;

  constructor(options: AgentBotOptions) {
    this.options = options;
    this.nick = options.agent.nick;
    this.brain = options.brain ?? new CodexBrain({
      client: options.codex,
      gateway: options.gateway,
      conversations: options.conversations,
      workspace: options.workspace,
      systemPrompt: buildAgentSystemPrompt(options.agent),
      maxToolIterations: 16,
    });
  }

  start(): IrcClient {
    if (this.irc) return this.irc;
    const greetChannel = this.options.greetChannel ?? this.options.channels[0];

    this.irc = new IrcClient({
      host: this.options.host,
      port: this.options.port,
      nick: this.nick,
      handlers: {
        onReady: () => {
          for (const channel of this.options.channels) this.irc?.join(channel);
          this.irc?.privmsg(greetChannel ?? '#agents', this.greeting());
          console.error(`[agent:${this.nick}] online in ${this.options.channels.join(', ')}`);
        },
        onLine: (line) => {
          this.handle(line).catch((error) => {
            console.error(`[agent:${this.nick}] handler error: ${error.message}`);
          });
        },
        onError: (error) => console.error(`[agent:${this.nick}] irc error: ${error.message}`),
      },
    });

    return this.irc;
  }

  /** Disconnect the agent from IRC. Idempotent. */
  stop(): void {
    if (!this.irc) return;
    this.irc.quit(`${this.nick} going offline`);
    console.error(`[agent:${this.nick}] offline`);
    this.irc = undefined;
  }

  assignTaskChannel(task: { id: string; title: string; channel: string }): void {
    if (!this.irc) return;
    this.irc.join(task.channel);
    this.irc.privmsg(task.channel, `[task:${task.id}] [type:ack] ${this.nick} assigned: ${task.title}`);
    this.irc.privmsg(task.channel, `[task:${task.id}] [type:wip] current step: starting assigned work`);
    this.startTask(task).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[agent:${this.nick}] task start error: ${message}`);
      this.irc?.privmsg(task.channel, `[task:${task.id}] [type:blocked] ${message}`);
    });
  }

  private async startTask(task: { id: string; title: string; channel: string }): Promise<void> {
    const prompt = [
      `[task:${task.id}] Start this assigned task in ${task.channel}: ${task.title}`,
      'Read the repo context you need, then report progress with task protocol lines.',
      'Use IRC_TOOL write_file for code edits and run_verification for checks.',
      'Do not say you are read-only while IRC_TOOL write_file is available.',
      'Do not stop after ack; continue until you emit [type:wip], [type:result], and [type:rdt].',
      'Use [type:blocked] only when a human decision is required.',
    ].join('\n');
    const heartbeat = setInterval(() => {
      this.irc?.privmsg(task.channel, `[task:${task.id}] [type:wip] still working`);
    }, this.options.taskHeartbeatMs ?? 25_000);
    const output = await this.brain.respond(prompt, {
      contextKey: `agent:${this.nick}:task:${task.id}`,
      sender: 'orchestrator',
      channel: task.channel,
    }).finally(() => clearInterval(heartbeat));
    for (const chunk of outgoingLines(ensureTaskProtocolOutput(task.id, output), 400)) {
      this.irc?.privmsg(task.channel, chunk);
    }
  }

  private async handle(line: ParsedLine): Promise<void> {
    if (line.command !== 'PRIVMSG') return;
    const [target, text] = line.params;
    if (!target || text === undefined) return;

    const sender = nickFromPrefix(line.prefix);
    if (sender.toLowerCase() === this.nick.toLowerCase()) return;

    const isDm = target.toLowerCase() === this.nick.toLowerCase();
    const turn = buildAgentTurn({ agentNick: this.nick, sender, target, text });
    if (!turn) return;

    try {
      const output = await this.brain.respond(turn.prompt, {
        contextKey: turn.contextKey,
        sender,
        channel: isDm ? undefined : target,
      });
      for (const chunk of outgoingLines(ensureChainRef(turn.chainRef, output), 400)) {
        this.irc?.privmsg(turn.replyTarget, chunk);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[agent:${this.nick}] codex error: ${message}`);
      this.irc?.privmsg(turn.replyTarget, ensureChainRef(turn.chainRef, `(codex error: ${message})`));
    }
  }

  private greeting(): string {
    const ctx = truncate(this.options.agent.context, 120);
    return `${this.nick} online — role: ${this.options.agent.role}. ${ctx}`.trim();
  }
}

function truncate(value: string, size: number): string {
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

function chunkLines(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > size) {
    chunks.push(remaining.slice(0, size));
    remaining = remaining.slice(size);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function outgoingLines(text: string, size: number): string[] {
  return text
    .split(/\r?\n/)
    .flatMap(splitTaskProtocolLines)
    .flatMap((line) => chunkLines(line, size));
}

function splitTaskProtocolLines(text: string): string[] {
  const starts = [...text.matchAll(/\[task:[^\]]+\]\s*(?:\[from:[^\]]+\]\s*)?\[type:[^\]]+\]/g)].map(
    (match) => match.index ?? 0,
  );
  if (starts.length <= 1) return [text];
  return starts.map((start, index) => text.slice(start, starts[index + 1]).trim()).filter(Boolean);
}
