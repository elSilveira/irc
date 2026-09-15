import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAgentForTask } from './agent-routing.js';
import type { Task } from '@irc/db';

const baseAgent = {
  id: 'a',
  nick: 'a',
  role: 'worker',
  status: 'idle',
  context: '',
  strengths: '',
  weaknesses: '',
  capacity: 1,
  skills: '',
  channels: '',
};

function task(input: Partial<Task> & Pick<Task, 'id' | 'title' | 'status' | 'assignedTo'>): Task {
  return {
    channel: input.channel ?? input.id.toLowerCase().replace('task', '#task'),
    projectChannel: null,
    workspace: null,
    ...input,
  };
}

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
    tasks: [task({ id: 'TASK-0001', title: 'Busy', status: 'doing', assignedTo: 'feature' })],
  });

  assert.equal(result?.agent.id, 'feature');
  assert.equal(result?.status, 'queued');
});

test('chooseAgentForTask treats QA lifecycle statuses as active work', () => {
  const result = chooseAgentForTask({
    title: 'Add tests',
    agents: [{ ...baseAgent, id: 'impl', strengths: 'tests', capacity: 1 }],
    tasks: [task({ id: 'TASK-0001', title: 'QA', status: 'testing', assignedTo: 'impl' })],
  });

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
