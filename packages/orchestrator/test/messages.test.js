const test = require('node:test');
const assert = require('node:assert/strict');

const { formatAgentMessage } = require('../src/messages');

test('formats structured agent messages', () => {
  const message = formatAgentMessage({
    taskId: 'TASK-0001',
    agent: 'manager-agent',
    status: 'plan_ready',
    body: 'Plan ready.',
  });

  assert.equal(
    message,
    '[TASK-0001] [manager-agent] [status:plan_ready]\nPlan ready.',
  );
});

test('requires task id, agent, status, and body', () => {
  assert.throws(
    () => formatAgentMessage({ taskId: 'TASK-0001', agent: 'manager-agent' }),
    /status is required/,
  );
});
