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

test('chooseAgentForTask does not treat implementation handoff context as planner identity', () => {
  const result = chooseAgentForTask({
    title: 'Fix modal connection',
    agents: [
      {
        ...baseAgent,
        id: 'feature-implementer',
        role: 'implementation',
        context: 'Use after plan has produced an actionable spec.',
      },
      { ...baseAgent, id: 'plan', role: 'planning', context: 'Creates plans before implementation.' },
    ],
    tasks: [],
  });

  assert.equal(result?.agent.id, 'plan');
});

test('chooseAgentForTask prefers dedicated planner over secondary planning skills', () => {
  const result = chooseAgentForTask({
    title: 'Fix agent routing',
    agents: [
      { ...baseAgent, id: 'git', role: 'repository maintenance', skills: 'ops,planning,routing' },
      { ...baseAgent, id: 'investment_advisor', role: 'portfolio planning agent' },
      { ...baseAgent, id: 'plan', role: 'planning', skills: 'orchestration,planning,routing' },
    ],
    tasks: [],
  });

  assert.equal(result?.agent.id, 'plan');
});

test('chooseAgentForTask honors the first explicit agent flow mention', () => {
  const result = chooseAgentForTask({
    title: 'Ask @testing to validate, then @plan before feature work',
    agents: [
      { ...baseAgent, id: 'feature-implementer', role: 'implementation' },
      { ...baseAgent, id: 'plan', role: 'planning' },
      { ...baseAgent, id: 'tester', nick: 'Tester', role: 'Tester', skills: 'qa,testing,review' },
    ],
    tasks: [],
  });

  assert.equal(result?.agent.id, 'tester');
});
