const test = require('node:test');
const assert = require('node:assert/strict');

const { createAgentRepository } = require('../src/agent-repository');

test('persists agent context in sqlite', () => {
  const repository = createAgentRepository(':memory:');

  repository.createAgent({
    id: 'researcher-agent',
    nick: 'researcher-agent',
    role: 'researcher',
    context: 'Finds missing context and proposes research steps',
  });

  assert.deepEqual(repository.findAgent('researcher-agent'), {
    id: 'researcher-agent',
    nick: 'researcher-agent',
    role: 'researcher',
    status: 'idle',
    context: 'Finds missing context and proposes research steps',
    strengths: '',
    weaknesses: '',
    capacity: 1,
    skills: '',
    modelProvider: '',
    modelAuth: '',
    modelName: '',
  });
});

test('rejects duplicate agents', () => {
  const repository = createAgentRepository(':memory:');
  const agent = {
    id: 'qa-agent',
    nick: 'qa-agent',
    role: 'qa',
    context: 'Reviews plans and test checklists',
  };

  repository.createAgent(agent);

  assert.throws(() => repository.createAgent(agent), /agent already exists/);
});

test('lists, updates, and deletes agents', () => {
  const repository = createAgentRepository(':memory:');
  repository.createAgent({ id: 'a', nick: 'agent-a', role: 'researcher', context: 'old' });
  repository.createAgent({ id: 'b', nick: 'agent-b', role: 'qa', context: 'checks' });

  assert.deepEqual(repository.listAgents().map((agent) => agent.id), ['a', 'b']);

  const updated = repository.updateAgent('a', {
    role: 'implementer',
    context: 'new',
    strengths: 'typescript,tests',
    weaknesses: 'design',
    capacity: 2,
    skills: 'implementation,tdd',
  });
  assert.equal(updated.role, 'implementer');
  assert.equal(updated.context, 'new');
  assert.equal(updated.strengths, 'typescript,tests');
  assert.equal(updated.weaknesses, 'design');
  assert.equal(updated.capacity, 2);
  assert.equal(updated.skills, 'implementation,tdd');

  assert.equal(repository.deleteAgent('a'), true);
  assert.equal(repository.findAgent('a'), null);
  assert.equal(repository.deleteAgent('missing'), false);
});

test('stores per-agent model routing fields', () => {
  const repository = createAgentRepository(':memory:');

  const created = repository.createAgent({
    id: 'helper-agent',
    nick: 'helper',
    role: 'helper',
    context: 'Helps users',
    modelProvider: 'glm-5.2-z-ai',
    modelAuth: 'login',
    modelName: 'glm-5.2',
  });

  assert.equal(created.modelProvider, 'glm-5.2-z-ai');
  assert.equal(created.modelAuth, 'login');
  assert.equal(created.modelName, 'glm-5.2');

  const updated = repository.updateAgent('helper-agent', {
    modelProvider: 'ollama',
    modelAuth: 'api-key',
    modelName: 'llama3.1',
  });

  assert.equal(updated.modelProvider, 'ollama');
  assert.equal(updated.modelAuth, 'api-key');
  assert.equal(updated.modelName, 'llama3.1');
});
