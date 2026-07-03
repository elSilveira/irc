const test = require('node:test');
const assert = require('node:assert/strict');

const { handleBotServ } = require('../src/botserv-service');

test('returns BotServ help', () => {
  assert.deepEqual(handleBotServ('HELP', {}), {
    ok: true,
    joins: [],
    replies: ['BotServ commands: HELP | NEW <title> | AGENTS'],
  });
});

test('creates task channels through BotServ NEW', () => {
  const tasks = {
    createTask(title) {
      assert.equal(title, 'Build agent');
      return { id: 'TASK-0001', channel: '#task-0001' };
    },
  };

  assert.deepEqual(handleBotServ('NEW "Build agent"', { tasks }), {
    ok: true,
    joins: ['#task-0001'],
    replies: ['Created TASK-0001 in #task-0001.'],
  });
});

test('lists available service agents', () => {
  assert.deepEqual(handleBotServ('AGENTS', {}), {
    ok: true,
    joins: [],
    replies: ['Agents: codex-agent'],
  });
});
