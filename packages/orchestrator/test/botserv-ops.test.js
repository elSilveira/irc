const test = require('node:test');
const assert = require('node:assert/strict');

const { handleBotServ } = require('../src/botserv-service');

test('BotService BUILD delegates to service ops runner', () => {
  const calls = [];
  const ops = {
    run(action) {
      calls.push(action);
      return { ok: true, message: `Started ${action}` };
    },
  };

  assert.deepEqual(handleBotServ('BUILD', { ops }), {
    ok: true,
    joins: [],
    replies: ['Started build'],
  });
  assert.deepEqual(calls, ['build']);
});

test('BotService RESTART delegates to service ops runner', () => {
  const ops = {
    run(action) {
      return { ok: true, message: `Started ${action}` };
    },
  };

  assert.deepEqual(handleBotServ('RESTART', { ops }).replies, ['Started restart']);
});

test('BotService DEPLOY delegates one build-then-restart op', () => {
  const calls = [];
  const ops = {
    run(action) {
      calls.push(action);
      return { ok: true, message: `Started ${action}` };
    },
  };

  assert.deepEqual(handleBotServ('DEPLOY', { ops }).replies, ['Started deploy']);
  assert.deepEqual(calls, ['deploy']);
});

test('BotService reports failed service ops', () => {
  const calls = [];
  const ops = {
    run(action) {
      calls.push(action);
      return { ok: false, message: `${action} failed` };
    },
  };

  assert.deepEqual(handleBotServ('DEPLOY', { ops }).replies, ['deploy failed']);
  assert.deepEqual(calls, ['deploy']);
});
