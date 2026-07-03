const test = require('node:test');
const assert = require('node:assert/strict');

const { handleCommand } = require('../src/command-handler');

test('creates an agent with persistent context', () => {
  const created = [];
  const repository = {
    createAgent(agent) {
      created.push(agent);
      return { ...agent, status: 'idle' };
    },
  };

  const result = handleCommand(
    '@orc agent create researcher-agent --nick researcher --role researcher --context "Finds missing context"',
    { agents: repository },
  );

  assert.deepEqual(created, [{
    id: 'researcher-agent',
    nick: 'researcher',
    role: 'researcher',
    context: 'Finds missing context',
  }]);
  assert.deepEqual(result, {
    ok: true,
    message: 'Created agent researcher-agent with role researcher.',
  });
});

test('rejects incomplete agent create commands', () => {
  const result = handleCommand('@orc agent create researcher-agent', {
    agents: { createAgent() {} },
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'missing_required_agent_fields',
  });
});
