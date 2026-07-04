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
