import { COMMAND_PREFIX, ORCHESTRATOR_MENTION } from '@irc/shared';

export type RoutedKind = 'ignore' | 'command' | 'chat';

export interface RoutedMessage {
  kind: RoutedKind;
  sender: string;
  target: string;
  replyTarget: string;
  text: string;
  command?: { name: string; args: string[] };
  prompt?: string;
}

export interface RouteInput {
  botNick: string;
  sender: string;
  target: string;
  text: string;
}

export interface ManagedAgentDirectInput {
  botNick: string;
  sender: string;
  target: string;
  agentNicks: string[];
}

const DETERMINISTIC_COMMANDS = new Set([
  'help',
  'agents',
  'agent',
  'status',
  'tasks',
  'new',
  'projects',
  'project',
  'join',
  'logs',
  'approvals',
  'approve',
  'deny',
  'assign',
  'review',
  'sign',
  'summarize',
]);

export function routeOrchestratorMessage(input: RouteInput): RoutedMessage {
  const { botNick, sender, target, text } = input;
  const isDm = target.toLowerCase() === botNick.toLowerCase();
  const replyTarget = isDm ? sender : target;
  const trimmed = text.trim();

  if (sender.toLowerCase() === botNick.toLowerCase()) return ignore(input);

  if (isDm) return { kind: 'chat', sender, target, replyTarget, text, prompt: trimmed };

  const mention = matchMention(trimmed, ORCHESTRATOR_MENTION);
  if (mention !== null) return { kind: 'chat', sender, target, replyTarget, text, prompt: mention };

  const prefixed = parsePrefixedCommand(trimmed, COMMAND_PREFIX);
  if (prefixed) return routePrefixedCommand(input, replyTarget, prefixed.rest, true);

  const slash = parseSlashCommand(trimmed);
  if (slash) return routePrefixedCommand(input, replyTarget, slash.rest, false);

  return ignore(input);
}

export function isManagedAgentDirectMessage(input: ManagedAgentDirectInput): boolean {
  if (input.target.toLowerCase() !== input.botNick.toLowerCase()) return false;
  const sender = input.sender.toLowerCase();
  return input.agentNicks.some((nick) => nick.toLowerCase() === sender);
}

function routePrefixedCommand(input: RouteInput, replyTarget: string, rest: string, allowChatFallback: boolean): RoutedMessage {
  const [name, ...args] = tokenize(rest);
  if (!name) return ignore(input);
  const commandName = name.toLowerCase();
  if (DETERMINISTIC_COMMANDS.has(commandName)) {
    return { kind: 'command', sender: input.sender, target: input.target, replyTarget, text: input.text, command: { name: commandName, args } };
  }
  if (allowChatFallback) return { kind: 'chat', sender: input.sender, target: input.target, text: input.text, replyTarget, prompt: rest };
  return ignore(input);
}

function parsePrefixedCommand(text: string, prefix: string): { rest: string } | null {
  if (!text.toLowerCase().startsWith(prefix)) return null;
  return { rest: text.slice(prefix.length).trim() };
}

function parseSlashCommand(text: string): { rest: string } | null {
  if (!text.startsWith('/')) return null;
  const rest = text.slice(1).trim();
  return rest.length > 0 ? { rest } : null;
}

function matchMention(text: string, mention: string): string | null {
  const lower = text.toLowerCase();
  if (!lower.startsWith(mention.toLowerCase())) return null;
  const rest = text.slice(mention.length).replace(/^[:,\s]+/, '');
  return rest.length > 0 ? rest : null;
}

function ignore(input: RouteInput): RoutedMessage {
  return { kind: 'ignore', sender: input.sender, target: input.target, replyTarget: input.sender, text: input.text };
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  for (const char of text) {
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === ' ' && !inQuote) {
      push(tokens, current);
      current = '';
      continue;
    }
    current += char;
  }
  push(tokens, current);
  return tokens;
}

function push(tokens: string[], value: string): void {
  const token = value.trim();
  if (token) tokens.push(token);
}
