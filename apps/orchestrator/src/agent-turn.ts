import { CODEX_TOOL_INSTRUCTIONS } from './codex-brain.js';
import { TASK_PROTOCOL_INSTRUCTIONS } from './task-events.js';
import {
  buildChainContextKey,
  createChainRef,
  extractChainRef,
  frameChainPrompt,
} from './conversation-chain.js';

export interface AgentIdentity {
  id: string;
  nick: string;
  role: string;
  context: string;
}

export interface AgentTurnInput {
  agentNick: string;
  sender: string;
  target: string;
  text: string;
}

export interface AgentTurn {
  chainRef: string;
  contextKey: string;
  prompt: string;
  replyTarget: string;
}

export function buildAgentSystemPrompt(agent: AgentIdentity): string {
  return [
    `You are the IRC agent "${agent.nick}" (id ${agent.id}).`,
    `Role: ${agent.role}.`,
    `Operating context: ${agent.context}`,
    'Stay in character, be concise (a few short IRC lines), and answer the user.',
    'When you delegate work or answer later, include the current [chain:<id>] marker.',
    'You can respond by DM or by mentioning @name in the current channel.',
    '',
    CODEX_TOOL_INSTRUCTIONS,
    '',
    TASK_PROTOCOL_INSTRUCTIONS,
  ].join('\n');
}

export function buildAgentTurn(input: AgentTurnInput): AgentTurn | null {
  const isDm = input.target.toLowerCase() === input.agentNick.toLowerCase();
  const mention = matchMentionEnd(input.text, input.agentNick);
  if (!isDm && mention === null) return null;

  const prompt = isDm ? input.text.trim() : input.text.slice(mention ?? 0).replace(/^[\s:,]+/, '').trim();
  if (!prompt) return null;

  const chainRef = extractChainRef(prompt) ?? createChainRef({
    agent: input.agentNick,
    sender: input.sender,
    target: input.target,
    prompt,
  });

  return {
    chainRef,
    contextKey: buildChainContextKey({
      agent: input.agentNick,
      isDm,
      sender: input.sender,
      target: input.target,
      chainRef,
    }),
    prompt: frameChainPrompt(chainRef, prompt),
    replyTarget: isDm ? input.sender : input.target,
  };
}

function matchMentionEnd(text: string, nick: string): number | null {
  const re = new RegExp(`^@?\\s*${escapeRegExp(nick)}\\b`, 'i');
  const trimmed = text.trimStart();
  const match = trimmed.match(re);
  if (!match) return null;
  return text.length - trimmed.length + match[0].length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
