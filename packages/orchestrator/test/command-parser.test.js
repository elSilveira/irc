const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCommand } = require('../src/command-parser');

test('parses quoted new task command', () => {
  assert.deepEqual(parseCommand('@orc new "Build local IRC control plane"'), {
    ok: true,
    command: 'new',
    args: ['Build local IRC control plane'],
  });
});

test('parses plain command arguments', () => {
  assert.deepEqual(parseCommand('@orc assign TASK-0001 manager-agent'), {
    ok: true,
    command: 'assign',
    args: ['TASK-0001', 'manager-agent'],
  });
});

test('ignores non-orchestrator messages', () => {
  assert.deepEqual(parseCommand('hello'), {
    ok: false,
    reason: 'missing_prefix',
  });
});
