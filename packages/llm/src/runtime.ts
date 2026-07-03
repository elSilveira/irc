import type { ProviderName } from '@irc/shared';
import type { Provider, ChatModelOptions } from './provider.js';
import { toLimitError } from './provider.js';
import type { ChatRequest, ChatResponse, ProviderSwitchCallback } from './types.js';
import { ProviderLimitError } from './types.js';

export interface AgentRuntimeOptions {
  providers: Provider[];
  order?: ProviderName[];
  onSwitch?: ProviderSwitchCallback;
}

export class AgentRuntime {
  private readonly providers: Map<ProviderName, Provider>;
  private readonly order: ProviderName[];
  private readonly limited = new Set<ProviderName>();
  private readonly onSwitch?: ProviderSwitchCallback;

  constructor(options: AgentRuntimeOptions) {
    this.providers = new Map(options.providers.map((p) => [p.name, p]));
    this.order = options.order ?? options.providers.map((p) => p.name);
    this.onSwitch = options.onSwitch;

    if (this.order.length === 0) {
      throw new Error('AgentRuntime requires at least one provider');
    }
    for (const name of this.order) {
      if (!this.providers.has(name)) {
        throw new Error(`provider "${name}" listed in order is not registered`);
      }
    }
  }

  get configuredProviders(): ProviderName[] {
    return this.order.filter((name) => this.resolve(name)?.configured);
  }

  /** Resolve a plain chat response, falling back across providers on limits. */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const candidates = this.candidatesFor(request.preferred);
    if (candidates.length === 0) {
      throw new Error('no configured provider available for this request');
    }

    let lastLimit: ProviderLimitError | null = null;
    for (const provider of candidates) {
      try {
        const text = await provider.chat(request);
        return { text, provider: provider.name, model: request.model ?? provider.name };
      } catch (error) {
        if (error instanceof ProviderLimitError) {
          lastLimit = error;
          this.markLimited(provider.name, error.message);
          continue;
        }
        const limit = toLimitError(provider.name, error);
        if (limit.recoverable) {
          lastLimit = limit;
          this.markLimited(provider.name, limit.message);
          continue;
        }
        throw error;
      }
    }

    throw lastLimit ?? new Error('all providers failed');
  }

  /**
   * Return the first provider that supports tool-calling and is not limited.
   * The orchestrator agent uses this to obtain a LangChain `BaseChatModel`.
   */
  getToolCapableModel(options?: ChatModelOptions): unknown {
    for (const name of this.candidateNames(undefined)) {
      const provider = this.resolve(name);
      if (!provider?.supportsTools || !provider.getModel) continue;
      try {
        return provider.getModel(options);
      } catch {
        this.markLimited(name, 'model unavailable');
      }
    }
    throw new Error('no tool-capable provider available');
  }

  private candidatesFor(preferred: ProviderName | undefined): Provider[] {
    return this.candidateNames(preferred)
      .map((name) => this.resolve(name))
      .filter((p): p is Provider => Boolean(p && p.configured));
  }

  private candidateNames(preferred: ProviderName | undefined): ProviderName[] {
    const names = preferred ? [preferred, ...this.order.filter((n) => n !== preferred)] : this.order;
    return names.filter((name) => !this.limited.has(name));
  }

  private markLimited(name: ProviderName, reason: string): void {
    if (this.limited.has(name)) return;
    this.limited.add(name);
    const fallback = this.order.find((candidate) => candidate !== name && !this.limited.has(candidate));
    if (fallback) {
      this.onSwitch?.({ from: name, to: fallback, reason });
    }
  }

  private resolve(name: ProviderName): Provider | undefined {
    return this.providers.get(name);
  }
}
