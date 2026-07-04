import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { reconcileManagedAgents } from './agent-reconcile.js';
import type { AgentSummary } from './supervisor.js';

test('reconcileManagedAgents starts agents created after startup', () => {
  const repos = createRepositories(':memory:');
  const calls: string[] = [];
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'Implements IRC features',
  });

  reconcileManagedAgents({
    repos,
    channels: ['#agents'],
    log: (message) => calls.push(message),
    supervisor: {
      reconcile(agents: AgentSummary[], channels: string[], greetChannel?: string) {
        calls.push(`${agents[0]?.nick}:${channels.join(',')}:${greetChannel ?? ''}`);
        return { started: ['FeatureImpl'], stopped: [], unchanged: 0 };
      },
    } as never,
  });

  assert.deepEqual(calls, [
    'FeatureImpl:#agents:',
    '[orchestrator] reconcile +FeatureImpl',
  ]);
});
