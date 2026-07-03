import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentRuntime, ProviderLimitError } from './index.js';
import type { Provider } from './provider.js';

function fakeProvider(name: Provider['name'], behaviour: {
  text?: string;
  limit?: boolean;
  configured?: boolean;
  supportsTools?: boolean;
}): Provider {
  return {
    name,
    supportsTools: behaviour.supportsTools ?? false,
    configured: behaviour.configured ?? true,
    async chat() {
      if (behaviour.limit) throw new ProviderLimitError(name, `${name} rate limited`, true);
      return behaviour.text ?? `${name}-reply`;
    },
  };
}

test('uses the first available provider', async () => {
  const runtime = new AgentRuntime({
    providers: [fakeProvider('openai', { text: 'hello', supportsTools: true })],
  });
  const result = await runtime.chat({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.provider, 'openai');
  assert.equal(result.text, 'hello');
});

test('falls back to the next provider when the first is limited', async () => {
  const runtime = new AgentRuntime({
    providers: [
      fakeProvider('openai', { limit: true, supportsTools: true }),
      fakeProvider('ollama', { text: 'ollama-ok' }),
    ],
  });

  const result = await runtime.chat({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.provider, 'ollama');
  assert.equal(result.text, 'ollama-ok');
});

test('invokes the switch callback when a provider is limited', async () => {
  const switches: { from: string; to: string }[] = [];
  const runtime = new AgentRuntime({
    providers: [
      fakeProvider('openai', { limit: true, supportsTools: true }),
      fakeProvider('ollama', { text: 'ok' }),
    ],
    onSwitch: (event) => switches.push({ from: event.from, to: event.to }),
  });

  await runtime.chat({ messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual(switches, [{ from: 'openai', to: 'ollama' }]);
});

test('honors a preferred provider pin', async () => {
  const runtime = new AgentRuntime({
    providers: [
      fakeProvider('openai', { text: 'openai-ok', supportsTools: true }),
      fakeProvider('ollama', { text: 'ollama-ok' }),
    ],
  });

  const result = await runtime.chat({
    messages: [{ role: 'user', content: 'hi' }],
    preferred: 'ollama',
  });
  assert.equal(result.provider, 'ollama');
});

test('throws when all providers are limited', async () => {
  const runtime = new AgentRuntime({
    providers: [
      fakeProvider('openai', { limit: true, supportsTools: true }),
      fakeProvider('ollama', { limit: true }),
    ],
  });
  await assert.rejects(() => runtime.chat({ messages: [{ role: 'user', content: 'hi' }] }));
});

test('configuredProviders excludes unconfigured providers', () => {
  const runtime = new AgentRuntime({
    providers: [
      fakeProvider('openai', { configured: false, supportsTools: true }),
      fakeProvider('ollama', { configured: true }),
    ],
  });
  assert.deepEqual(runtime.configuredProviders, ['ollama']);
});
