import { ChatOllama } from '@langchain/community/chat_models/ollama';
import type { Provider, ChatModelOptions } from '../provider.js';
import type { ChatRequest } from '../types.js';
import { ProviderLimitError } from '../types.js';
import { looksLikeLimitError } from '../provider.js';
import { toBaseMessages } from '../messages.js';

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export function createOllamaProvider(options: OllamaProviderOptions = {}): Provider {
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const defaultModel = options.model ?? process.env.OLLAMA_MODEL ?? 'llama3.1';
  const temperature = options.temperature ?? 0.2;

  function buildModel(modelOverride?: string): ChatOllama {
    return new ChatOllama({
      baseUrl,
      model: modelOverride ?? defaultModel,
      temperature,
    });
  }

  return {
    name: 'ollama',
    supportsTools: true,
    configured: true,
    async chat(request: ChatRequest): Promise<string> {
      try {
        const response = await buildModel(request.model).invoke(toBaseMessages(request.messages));
        return extractText(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (looksLikeLimitError(message) || /connect econnrefused|fetch failed/i.test(message)) {
          throw new ProviderLimitError('ollama', message, true);
        }
        throw error;
      }
    },
    getModel(options?: ChatModelOptions) {
      return buildModel(options?.model);
    },
  };
}

function extractText(response: unknown): string {
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    if (typeof record.content === 'string') return record.content;
  }
  return String(response ?? '');
}
