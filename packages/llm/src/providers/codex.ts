import type { Provider } from '../provider.js';
import type { ChatRequest } from '../types.js';
import { ProviderLimitError } from '../types.js';

/**
 * Injected Codex app-server client. The orchestrator app wires the real client
 * (the local `codex app-server` JSON-RPC bridge) so this package stays free of
 * the legacy JS transport code.
 */
export interface CodexClient {
  configured: boolean;
  generate(input: { prompt: string; threadId?: string }): Promise<{ threadId: string; text: string }>;
  startLogin?(): Promise<{ authUrl?: string; verificationUrl?: string; userCode?: string }>;
}

export function createCodexProvider(client: CodexClient): Provider {
  return {
    name: 'codex',
    supportsTools: false,
    configured: client.configured,
    async chat(request: ChatRequest): Promise<string> {
      const prompt = renderPrompt(request);
      try {
        const result = await client.generate({ prompt });
        return result.text;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ProviderLimitError('codex', message, true);
      }
    },
  };
}

/**
 * Render the message history into a single prompt for the turn-based Codex
 * protocol. Codex keeps its own per-thread context, so we send the latest user
 * turn plus the system framing.
 */
function renderPrompt(request: ChatRequest): string {
  const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
  return lastUser?.content ?? request.messages.at(-1)?.content ?? '';
}
