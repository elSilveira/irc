import type { ProviderName } from '@irc/shared';
import type { ChatMessage, ChatRequest } from './types.js';
import { ProviderLimitError } from './types.js';

export interface ChatModelOptions {
  model?: string;
  temperature?: number;
}

/**
 * A single LLM provider. Only OpenAI/Ollama implement `getChatModel` because
 * they support native tool-calling. Codex is a turn-based read-only protocol
 * and is used for plain-chat fallback only.
 */
export interface Provider {
  readonly name: ProviderName;
  readonly supportsTools: boolean;
  readonly configured: boolean;
  chat(request: ChatRequest): Promise<string>;
  getModel?(options?: ChatModelOptions): unknown;
}

const LIMIT_SIGNALS = [
  'rate_limit',
  'rate limit',
  '429',
  'quota',
  'insufficient_quota',
  'insufficient quota',
  'billing',
  'exceeded your current quota',
  'capacity',
  'overloaded',
  'overloaded_capacity',
  'service_unavailable',
  'authentication',
  'invalid_api_key',
  'unauthorized',
  'token is not valid',
  'subscription',
  'limit reached',
];

export function looksLikeLimitError(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return LIMIT_SIGNALS.some((signal) => lower.includes(signal));
}

export function toLimitError(provider: ProviderName, error: unknown): ProviderLimitError {
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderLimitError(provider, message, looksLikeLimitError(message));
}

export function systemMessage(messages: ChatMessage[]): string {
  return messages.find((m) => m.role === 'system')?.content ?? '';
}
