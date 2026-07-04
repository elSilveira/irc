import { createHash } from 'node:crypto';

const CHAIN_RE = /\[(?:chain|ctx|ref):([A-Za-z0-9_-]{3,48})\]/;

export interface ChainSeed {
  agent: string;
  sender: string;
  target: string;
  prompt: string;
}

export interface ChainContextInput {
  agent: string;
  isDm: boolean;
  sender: string;
  target: string;
  chainRef: string;
}

export function extractChainRef(text: string): string | null {
  return text.match(CHAIN_RE)?.[1] ?? null;
}

export function createChainRef(seed: ChainSeed): string {
  return createHash('sha256')
    .update(seed.agent)
    .update('\0')
    .update(seed.sender)
    .update('\0')
    .update(seed.target)
    .update('\0')
    .update(seed.prompt)
    .digest('hex')
    .slice(0, 12);
}

export function buildChainContextKey(input: ChainContextInput): string {
  const scope = input.isDm ? `dm:${input.sender}` : `channel:${input.target}`;
  return `agent:${input.agent}:${scope}:chain:${input.chainRef}`;
}

export function frameChainPrompt(chainRef: string, prompt: string): string {
  return [
    `Conversation chain: [chain:${chainRef}]`,
    'Use this chain id to correlate replies, follow-ups, and delegated work.',
    `When asking another agent or replying later, include [chain:${chainRef}] in the message.`,
    '',
    prompt,
  ].join('\n');
}

export function ensureChainRef(chainRef: string, text: string): string {
  return extractChainRef(text) ? text : `[chain:${chainRef}] ${text}`;
}
