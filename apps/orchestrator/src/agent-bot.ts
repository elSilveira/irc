import type { CodexClient } from '@irc/llm';
import type { ConversationRepository } from '@irc/db';
import type { ToolGateway } from '@irc/tools';
import { CodexBrain, CODEX_TOOL_INSTRUCTIONS } from './codex-brain.js';
import type { Brain } from './brain.js';
import { IrcClient, nickFromPrefix, type ParsedLine } from './irc.js';

export interface AgentBotOptions {
  host: string;
  port: number;
  agent: { id: string; nick: string; role: string; context: string };
  /** Channels the agent should join. */
  channels: string[];
  /** Channel where the agent posts its online greeting. Defaults to channels[0]. */
  greetChannel?: string;
  codex: CodexClient;
  conversations: ConversationRepository;
  gateway: ToolGateway;
  workspace: string;
  brain?: Brain;
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

  private async handle(line: ParsedLine): Promise<void> {
    if (line.command !== 'PRIVMSG') return;
    const [target, text] = line.params;
    if (!target || text === undefined) return;

    const sender = nickFromPrefix(line.prefix);
    if (sender.toLowerCase() === this.nick.toLowerCase()) return;

    const isDm = target.toLowerCase() === this.nick.toLowerCase();
    const mention = matchMention(text, this.nick);

    if (!isDm && mention === null) return;

    const prompt = isDm ? text.trim() : text.slice(mention ?? 0).replace(/^[\s:,]+/, '').trim();
    if (!prompt) return;

    const contextKey = isDm
      ? `agent:${this.nick}:dm:${sender}`
      : `agent:${this.nick}:channel:${target}`;
    const replyTarget = isDm ? sender : target;

    try {
      const output = await this.brain.respond(prompt, { contextKey, sender, channel: isDm ? undefined : target });
      for (const chunk of chunkLines(output, 400)) {
        this.irc?.privmsg(replyTarget, chunk);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[agent:${this.nick}] codex error: ${message}`);
      this.irc?.privmsg(replyTarget, `(codex error: ${message})`);
    }
  }

  private greeting(): string {
    const ctx = truncate(this.options.agent.context, 120);
    return `${this.nick} online — role: ${this.options.agent.role}. ${ctx}`.trim();
  }
}

export function buildAgentSystemPrompt(agent: AgentBotOptions['agent']): string {
  return [
    `You are the IRC agent "${agent.nick}" (id ${agent.id}).`,
    `Role: ${agent.role}.`,
    `Operating context: ${agent.context}`,
    'Stay in character, be concise (a few short IRC lines), and answer the user.',
    '',
    CODEX_TOOL_INSTRUCTIONS,
  ].join('\n');
}

function matchMention(text: string, nick: string): number | null {
  const re = new RegExp(`^@?\\s*${escapeRegExp(nick)}\\b`, 'i');
  const match = text.trim().match(re);
  if (!match) return null;
  return text.indexOf(match[0]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
