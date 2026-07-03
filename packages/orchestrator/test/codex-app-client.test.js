const test = require('node:test');
const assert = require('node:assert/strict');

const { createCodexAppClient } = require('../src/codex-app-client');

function createFakeTransport() {
  const calls = [];
  const notifications = [
    {
      method: 'item/agentMessage/delta',
      params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'h' },
    },
    {
      method: 'item/agentMessage/delta',
      params: { threadId: 'other', turnId: 'turn_1', delta: 'ignored' },
    },
    {
      method: 'item/agentMessage/delta',
      params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'i' },
    },
    {
      method: 'turn/completed',
      params: { threadId: 'thr_1', turnId: 'turn_1' },
    },
  ];

  return {
    calls,
    async request(method, params) {
      calls.push({ type: 'request', method, params });
      if (method === 'initialize') {
        return { protocolVersion: 1 };
      }
      if (method === 'account/login/start') {
        return { authUrl: 'https://example.com/auth' };
      }
      if (method === 'thread/start') {
        return { threadId: 'thr_1' };
      }
      if (method === 'turn/start') {
        return { turnId: 'turn_1' };
      }
      throw new Error(`unexpected request: ${method}`);
    },
    async notify(method, params) {
      calls.push({ type: 'notify', method, params });
    },
    async nextNotification() {
      return notifications.shift();
    },
  };
}

test('logs in and generates text through the Codex app server', async () => {
  const transport = createFakeTransport();
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });

  assert.equal((await client.startLogin()).authUrl, 'https://example.com/auth');
  assert.deepEqual(await client.generate({ prompt: 'hello' }), {
    threadId: 'thr_1',
    text: 'hi',
  });

  assert.deepEqual(transport.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'account/login/start',
    'thread/start',
    'turn/start',
  ]);
});
