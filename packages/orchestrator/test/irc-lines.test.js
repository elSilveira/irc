const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatJoin,
  formatNick,
  formatPrivmsg,
  formatUser,
  parseLine,
} = require('../src/irc-lines');

test('parses channel private messages', () => {
  assert.deepEqual(
    parseLine(':eduardo!u@host PRIVMSG #control :@codex status'),
    {
      prefix: 'eduardo!u@host',
      command: 'PRIVMSG',
      params: ['#control', '@codex status'],
    },
  );
});

test('formats basic IRC commands', () => {
  assert.equal(formatNick('codex-agent'), 'NICK codex-agent\r\n');
  assert.equal(formatUser('codex-agent'), 'USER codex-agent 0 * :codex-agent\r\n');
  assert.equal(formatJoin('#control'), 'JOIN #control\r\n');
  assert.equal(formatPrivmsg('#control', 'ready'), 'PRIVMSG #control :ready\r\n');
});
