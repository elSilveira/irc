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
    channels: '#control,#planning',
  });

  assert.equal(agent.id, 'manager-agent');
  assert.equal(agent.status, 'idle');
  assert.equal(agent.strengths, 'planning,docs');
  assert.equal(agent.weaknesses, 'frontend');
  assert.equal(agent.capacity, 2);
  assert.equal(agent.skills, 'orchestration,planning');
  assert.equal(agent.channels, '#control,#planning');
  assert.equal(agent.modelProvider, '');
  assert.equal(agent.modelAuth, '');
  assert.equal(agent.modelName, '');
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

test('updateAgent edits role, context, and channel membership', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'qa', nick: 'qa-agent', role: 'coder', context: 'old' });
  const updated = repos.agents.updateAgent('qa', {
    role: 'qa',
    context: 'reviews work',
    strengths: 'tests,review',
    weaknesses: 'infra',
    capacity: 3,
    skills: 'qa,testing',
    channels: '#qa,#review',
  });

  assert.equal(updated.role, 'qa');
  assert.equal(updated.context, 'reviews work');
  assert.equal(updated.strengths, 'tests,review');
  assert.equal(updated.weaknesses, 'infra');
  assert.equal(updated.capacity, 3);
  assert.equal(updated.skills, 'qa,testing');
  assert.equal(updated.channels, '#qa,#review');
  repos.close();
});

test('deleteAgent removes one agent and reports missing ids', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'qa', nick: 'qa-agent', role: 'qa', context: 'reviews work' });

  assert.equal(repos.agents.deleteAgent('qa'), true);
  assert.equal(repos.agents.findAgent('qa'), null);
  assert.equal(repos.agents.deleteAgent('missing'), false);
  repos.close();
});

test('listAgents returns every agent with default channels', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({ id: 'a', nick: 'a', role: 'r', context: 'c' });
  repos.agents.createAgent({ id: 'b', nick: 'b', role: 'r', context: 'c' });
  const agents = repos.agents.listAgents();
  assert.equal(agents.length, 2);
  assert.deepEqual(agents.map((agent) => agent.channels), ['', '']);
  repos.close();
});

test('agents can persist per-agent model selection', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({
    id: 'botservice',
    nick: 'BotService',
    role: 'service',
    context: 'Manages agents',
    modelProvider: 'glm-5.2-z-ai',
    modelAuth: 'api-key',
    modelName: 'glm-5.2',
  });

  const updated = repos.agents.updateAgent('botservice', {
    modelProvider: 'codex',
    modelAuth: 'login',
    modelName: 'gpt-5-codex',
  });

  assert.equal(updated.modelProvider, 'codex');
  assert.equal(updated.modelAuth, 'login');
  assert.equal(updated.modelName, 'gpt-5-codex');
  repos.close();
});
