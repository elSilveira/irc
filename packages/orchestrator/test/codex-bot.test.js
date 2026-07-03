const test = require('node:test');
const assert = require('node:assert/strict');

const { handleLine } = require('../src/codex-bot');

function fakeSocket() {
  const writes = [];
  return {
    writes,
    write(value) {
      writes.push(value);
    },
  };
}

test('responds to ping', () => {
  const socket = fakeSocket();

  handleLine(socket, { channel: '#control' }, 'PING :abc');

  assert.deepEqual(socket.writes, ['PONG :abc\r\n']);
});

test('joins configured channel after welcome', () => {
  const socket = fakeSocket();

  handleLine(socket, { channel: '#control' }, ':server 001 codex-agent :Welcome');

  assert.deepEqual(socket.writes, ['JOIN #control\r\n']);
});

test('replies to codex messages in channel', () => {
  const socket = fakeSocket();

  handleLine(socket, {}, ':eduardo PRIVMSG #control :@codex echo hi');

  assert.deepEqual(socket.writes, ['PRIVMSG #control :hi\r\n']);
});
