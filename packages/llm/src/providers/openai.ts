import { ChatOpenAI } from '@langchain/openai';
import type { Provider, ChatModelOptions } from '../provider.js';
import type { ChatRequest } from '../types.js';
import { ProviderLimitError } from '../types.js';
import { looksLikeLimitError } from '../provider.js';
import { toBaseMessages } from '../messages.js';

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export function createOpenAIProvider(options: OpenAIProviderOptions = {}): Provider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const defaultModel = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const temperature = options.temperature ?? 0.2;

  const configured = Boolean(apiKey);

  function buildModel(modelOverride?: string): ChatOpenAI {
    if (!apiKey) {
      throw new ProviderLimitError('openai', 'OPENAI_API_KEY is not set', true);
    }
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: modelOverride ?? defaultModel,
      temperature,
    });
  }

  return {
    name: 'openai',
    supportsTools: true,
    configured,
    async chat(request: ChatRequest): Promise<string> {
      const model = buildModel(request.model);
      try {
        const response = await model.invoke(toBaseMessages(request.messages));
        return extractText(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (looksLikeLimitError(message)) {
          throw new ProviderLimitError('openai', message, true);
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
    if (Array.isArray(record.content)) {
      return record.content
        .map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text ?? ''))
        .join('');
    }
  }
  return String(response ?? '');
}
