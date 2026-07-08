import { inferAgentGraphRoute, inferAgentTools } from '@irc/shared';
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
  skills?: string;
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
  const route = inferAgentGraphRoute(agent);
  return [
    `You are the IRC agent "${agent.nick}" (id ${agent.id}).`,
    `Role: ${agent.role}.`,
    agent.skills ? `Skills: ${agent.skills}` : '',
    `Connected tools: ${inferAgentTools(agent).join(', ')}`,
    `LangGraph node: ${route.node}; Chain prefix: ${route.chainPrefix}; Channel scope: ${route.channelScope}; RAG scope: ${route.ragScope}.`,
    `Operating context: ${agent.context}`,
    plannerGuidance(agent),
    'Stay in character, be concise (a few short IRC lines), and answer the user.',
    'When you delegate work or answer later, include the current [chain:<id>] marker.',
    'Post task progress only in the active task channel and keep chain/RAG context scoped to that route.',
    'You can respond by DM or by mentioning @name in the current channel.',
    '',
    CODEX_TOOL_INSTRUCTIONS,
    '',
    TASK_PROTOCOL_INSTRUCTIONS,
  ].filter((line) => line !== '').join('\n');
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

function plannerGuidance(agent: AgentIdentity): string {
  const text = `${agent.id} ${agent.role} ${agent.context} ${agent.skills ?? ''}`.toLowerCase();
  if (!/\b(plan|planner|planning)\b/.test(text)) return '';
  return 'Planning duty: improve the task prompt before feature or implementation work, then coordinate with feature and QA agents to match expectations before handoff.';
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
