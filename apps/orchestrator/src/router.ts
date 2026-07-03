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

const DETERMINISTIC_COMMANDS = new Set(['help', 'agents', 'status', 'tasks', 'new']);

export function routeOrchestratorMessage(input: RouteInput): RoutedMessage {
  const { botNick, sender, target, text } = input;
  const isDm = target.toLowerCase() === botNick.toLowerCase();
  const replyTarget = isDm ? sender : target;
  const trimmed = text.trim();

  if (sender.toLowerCase() === botNick.toLowerCase()) {
    return ignore(input);
  }

  if (isDm) {
    return { kind: 'chat', sender, target, replyTarget, text, prompt: trimmed };
  }

  const mention = matchMention(trimmed, ORCHESTRATOR_MENTION);
  if (mention !== null) {
    return { kind: 'chat', sender, target, replyTarget, text, prompt: mention };
  }

  if (trimmed.toLowerCase().startsWith(COMMAND_PREFIX)) {
    const rest = trimmed.slice(COMMAND_PREFIX.length).trim();
    const [name, ...args] = tokenize(rest);
    if (!name) return ignore(input);
    if (DETERMINISTIC_COMMANDS.has(name.toLowerCase())) {
      return { kind: 'command', sender, target, replyTarget, text, command: { name: name.toLowerCase(), args } };
    }
    return { kind: 'chat', sender, target, replyTarget, text, prompt: rest };
  }

  return ignore(input);
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
