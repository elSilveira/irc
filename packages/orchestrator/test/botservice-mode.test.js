const test = require('node:test');
const assert = require('node:assert/strict');

const { handleLine } = require('../src/codex-bot');

test('BotService ignores channel codex prompts', async () => {
  const socket = { writes: [], write: (value) => socket.writes.push(value) };

  await handleLine(socket, {
    nick: 'BotService',
    botServNick: 'BotService',
    codex: {
      async generate() {
        throw new Error('must not generate');
      },
    },
  }, ':eduardo PRIVMSG #control :@codex hello');

  assert.deepEqual(socket.writes, []);
});
