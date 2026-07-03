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
