import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

test('createRepositories creates an agent and finds it', () => {
  const repos = createRepositories(':memory:');
  const agent = repos.agents.createAgent({
    id: 'manager-agent',
    nick: 'manager-agent',
    role: 'manager',
    context: 'Plans and coordinates work',
    strengths: 'planning,docs',
    weaknesses: 'frontend',
    capacity: 2,
    skills: 'orchestration,planning',
  });

  assert.equal(agent.id, 'manager-agent');
  assert.equal(agent.status, 'idle');
  assert.equal(agent.strengths, 'planning,docs');
  assert.equal(agent.weaknesses, 'frontend');
  assert.equal(agent.capacity, 2);
  assert.equal(agent.skills, 'orchestration,planning');
  assert.deepEqual(repos.agents.findAgent('manager-agent'), agent);
  repos.close();
});

test('createAgent rejects duplicate ids', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'a1', nick: 'a1', role: 'coder', context: 'x' });
  assert.throws(() =>
    repos.agents.createAgent({ id: 'a1', nick: 'a1', role: 'coder', context: 'x' }),
  );
  repos.close();
});

test('updateAgent edits role and context', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'qa', nick: 'qa-agent', role: 'coder', context: 'old' });
  const updated = repos.agents.updateAgent('qa', {
    role: 'qa',
    context: 'reviews work',
    strengths: 'tests,review',
    weaknesses: 'infra',
    capacity: 3,
    skills: 'qa,testing',
  });

  assert.equal(updated.role, 'qa');
  assert.equal(updated.context, 'reviews work');
  assert.equal(updated.strengths, 'tests,review');
  assert.equal(updated.weaknesses, 'infra');
  assert.equal(updated.capacity, 3);
  assert.equal(updated.skills, 'qa,testing');
  repos.close();
});

test('listAgents returns every agent', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'a', nick: 'a', role: 'r', context: 'c' });
  repos.agents.createAgent({ id: 'b', nick: 'b', role: 'r', context: 'c' });
  assert.equal(repos.agents.listAgents().length, 2);
  repos.close();
});
