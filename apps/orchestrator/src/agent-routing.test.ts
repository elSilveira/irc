import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAgentForTask } from './agent-routing.js';

const baseAgent = {
  id: 'a',
  nick: 'a',
  role: 'worker',
  status: 'idle',
  context: '',
  strengths: '',
  weaknesses: '',
  capacity: 1,
};

test('chooseAgentForTask prefers matching strengths', () => {
  const result = chooseAgentForTask({
    title: 'Update README documentation',
    agents: [
      { ...baseAgent, id: 'coder', strengths: 'typescript,tests' },
      { ...baseAgent, id: 'docs', strengths: 'readme,documentation' },
    ],
    tasks: [],
  });

  assert.equal(result?.agent.id, 'docs');
  assert.equal(result?.status, 'ready');
});

test('chooseAgentForTask queues for the best busy agent', () => {
  const result = chooseAgentForTask({
    title: 'Fix TypeScript tests',
    agents: [{ ...baseAgent, id: 'feature', strengths: 'typescript,tests' }],
    tasks: [{ id: 'TASK-0001', title: 'Busy', status: 'doing', channel: '#task-0001', assignedTo: 'feature' }],
  });

  assert.equal(result?.agent.id, 'feature');
  assert.equal(result?.status, 'queued');
});

test('chooseAgentForTask avoids weakness matches when possible', () => {
  const result = chooseAgentForTask({
    title: 'Deploy infrastructure change',
    agents: [
      { ...baseAgent, id: 'docs', strengths: 'docs', weaknesses: 'infrastructure' },
      { ...baseAgent, id: 'infra', strengths: 'deploy,infrastructure' },
    ],
    tasks: [],
  });

  assert.equal(result?.agent.id, 'infra');
});
