import type { ProviderName } from '@irc/shared';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Pin a single provider for this call; otherwise the runtime uses its order. */
  preferred?: ProviderName;
  model?: string;
}

export interface ChatResponse {
  text: string;
  provider: ProviderName;
  model: string;
}

export interface ProviderSwitchEvent {
  from: ProviderName;
  to: ProviderName;
  reason: string;
}

export type ProviderSwitchCallback = (event: ProviderSwitchEvent) => void;

/**
 * Thrown by a provider when it cannot serve a request because of quotas,
 * rate limits, billing, auth, or temporary capacity problems. The runtime
 * treats these as recoverable and falls back to the next provider.
 */
export class ProviderLimitError extends Error {
  readonly provider: ProviderName;
  readonly recoverable: boolean;

  constructor(provider: ProviderName, message: string, recoverable = true) {
    super(message);
    this.name = 'ProviderLimitError';
    this.provider = provider;
    this.recoverable = recoverable;
  }
}
