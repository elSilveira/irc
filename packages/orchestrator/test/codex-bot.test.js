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

test('sends channel codex prompts through persisted context', async () => {
  const socket = fakeSocket();
  const conversations = fakeConversations();
  const codex = fakeCodex('real reply', 'thr_1');

  await handleLine(socket, {
    nick: 'codex-agent',
    conversations,
    codex,
  }, ':eduardo PRIVMSG #control :@codex hello');

  assert.deepEqual(codex.calls, [{ prompt: 'hello', threadId: undefined }]);
  assert.deepEqual(conversations.saved, [{ contextKey: 'channel:#control', threadId: 'thr_1' }]);
  assert.deepEqual(socket.writes, ['PRIVMSG #control :real reply\r\n']);
});

test('replies to direct codex messages using sender context', async () => {
  const socket = fakeSocket();
  const conversations = fakeConversations({ 'dm:eduardo': 'thr_dm' });
  const codex = fakeCodex('direct reply', 'thr_dm');

  await handleLine(socket, {
    nick: 'codex-agent',
    conversations,
    codex,
  }, ':eduardo PRIVMSG codex-agent :hello');

  assert.deepEqual(codex.calls, [{ prompt: 'hello', threadId: 'thr_dm' }]);
  assert.deepEqual(socket.writes, ['PRIVMSG eduardo :direct reply\r\n']);
});

test('returns codex login url for login command', async () => {
  const socket = fakeSocket();
  const codex = {
    async startLogin() {
      return { authUrl: 'https://example.com/auth' };
    },
  };

  await handleLine(socket, {
    nick: 'codex-agent',
    codex,
  }, ':eduardo PRIVMSG #control :@codex login');

  assert.deepEqual(socket.writes, [
    'PRIVMSG #control :Codex login: https://example.com/auth\r\n',
  ]);
});

function fakeConversations(seed = {}) {
  const saved = [];
  return {
    saved,
    findThread(contextKey) {
      const threadId = seed[contextKey];
      return threadId ? { contextKey, threadId } : null;
    },
    saveThread(contextKey, threadId) {
      saved.push({ contextKey, threadId });
      seed[contextKey] = threadId;
    },
  };
}

function fakeCodex(text, threadId) {
  const calls = [];
  return {
    calls,
    async generate(input) {
      calls.push(input);
      return { threadId, text };
    },
  };
}
