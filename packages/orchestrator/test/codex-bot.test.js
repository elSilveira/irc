const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRuntimeConfig,
  handleLine,
} = require('../src/codex-bot');

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

  handleLine(socket, { channel: '#control' }, ':server 001 helper :Welcome');

  assert.deepEqual(socket.writes, ['JOIN #control\r\n']);
});

test('sends channel codex prompts through persisted context', async () => {
  const socket = fakeSocket();
  const conversations = fakeConversations();
  const codex = fakeCodex('real reply', 'thr_1');

  await handleLine(socket, {
    nick: 'helper',
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
    nick: 'helper',
    conversations,
    codex,
  }, ':eduardo PRIVMSG helper :hello');

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
    nick: 'helper',
    codex,
  }, ':eduardo PRIVMSG #control :@codex login');

  assert.deepEqual(socket.writes, [
    'PRIVMSG #control :Codex login: https://example.com/auth\r\n',
  ]);
});

test('ignores @orc commands so orchestrator owns task creation', async () => {
  const socket = fakeSocket();

  await handleLine(socket, {
    nick: 'helper',
    tasks: {
      createTask() {
        return {
          id: 'TASK-0001',
          title: 'Build agent',
          status: 'open',
          channel: '#task-0001',
        };
      },
    },
  }, ':eduardo PRIVMSG #control :@orc new "Build agent"');

  assert.deepEqual(socket.writes, []);
});

test('handles BotService direct NEW commands', async () => {
  const socket = fakeSocket();

  await handleLine(socket, {
    nick: 'BotService',
    botServNick: 'BotService',
    tasks: {
      createTask() {
        return { id: 'TASK-0001', channel: '#task-0001' };
      },
    },
  }, ':eduardo PRIVMSG BotService :NEW "Build agent"');

  assert.deepEqual(socket.writes, [
    'JOIN #task-0001\r\n',
    'PRIVMSG eduardo :Created TASK-0001 in #task-0001.\r\n',
  ]);
});

test('reads bot nick from cli args', () => {
  assert.equal(createRuntimeConfig(['--nick', 'BotService']).nick, 'BotService');
});

test('defaults the user helper bridge nick to helper', () => {
  assert.equal(createRuntimeConfig([], {}).nick, 'helper');
});

test('logs registration errors from the irc server', async () => {
  const logs = [];

  await handleLine(fakeSocket(), {
    log(message) {
      logs.push(message);
    },
  }, ':server 432 * BotServ :Erroneous nickname');

  assert.deepEqual(logs, ['IRC registration error 432: * BotServ Erroneous nickname']);
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
