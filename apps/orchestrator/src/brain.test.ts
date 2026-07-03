import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LangChainBrain, type AgentExecutorLike } from './brain.js';
import type { AgentRuntime } from '@irc/llm';
import type { ToolGateway } from '@irc/tools';

function makeBrain(canned: string, recorded: string[]) {
  return new LangChainBrain({
    runtime: { getToolCapableModel() {
      return 'fake-model';
    } } as unknown as AgentRuntime,
    gateway: {} as ToolGateway,
    buildExecutor: async (_model, _gateway, _systemPrompt): Promise<AgentExecutorLike> => ({
      async invoke(input: { input: string }) {
        recorded.push(input.input);
        return { output: canned };
      },
    }),
  });
}

test('LangChainBrain returns the executor output', async () => {
  const recorded: string[] = [];
  const brain = makeBrain('created manager-agent', recorded);

  const output = await brain.respond('create a manager agent', { contextKey: 'orchestrator:channel:#control' });
  assert.equal(output, 'created manager-agent');
  assert.deepEqual(recorded, ['create a manager agent']);
});

test('LangChainBrain caches the executor across calls', async () => {
  const recorded: string[] = [];
  const brain = makeBrain('ok', recorded);

  await brain.respond('first', { contextKey: 'orchestrator:channel:#control' });
  await brain.respond('second', { contextKey: 'orchestrator:channel:#control' });
  assert.deepEqual(recorded, ['first', 'second']);
});
