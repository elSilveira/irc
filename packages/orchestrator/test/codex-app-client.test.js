const test = require('node:test');
const assert = require('node:assert/strict');

const { createCodexAppClient } = require('../src/codex-app-client');

function createQueueTransport(handlers = {}) {
  const calls = [];
  const notifications = [];
  const waiters = [];

  function push(notification) {
    if (waiters.length > 0) {
      waiters.shift()(notification);
      return;
    }
    notifications.push(notification);
  }

  return {
    calls,
    push,
    async request(method, params) {
      calls.push({ type: 'request', method, params });
      if (handlers[method]) return handlers[method](params, calls);
      if (method === 'initialize') return { protocolVersion: 1 };
      if (method === 'account/login/start') return { authUrl: 'https://example.com/auth' };
      if (method === 'account/read') return { id: 'acct_1' };
      if (method === 'thread/start') return { thread: { id: 'thr_1' } };
      if (method === 'turn/start') return { turn: { id: 'turn_1' } };
      throw new Error(`unexpected request: ${method}`);
    },
    async notify(method, params) {
      calls.push({ type: 'notify', method, params });
    },
    nextNotification() {
      if (notifications.length > 0) return Promise.resolve(notifications.shift());
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function countCalls(transport, method) {
  return transport.calls.filter((call) => call.method === method).length;
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('logs in and generates text through the Codex app server', async () => {
  const transport = createQueueTransport();
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });

  assert.equal((await client.startLogin()).authUrl, 'https://example.com/auth');
  const generated = client.generate({ prompt: 'hello' });
  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'h' },
  });
  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'other', turnId: 'turn_1', delta: 'ignored' },
  });
  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'i' },
  });
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_1', turnId: 'turn_1' },
  });

  assert.deepEqual(await generated, { threadId: 'thr_1', text: 'hi' });
  assert.deepEqual(transport.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'account/login/start',
    'thread/start',
    'turn/start',
  ]);
});

test('serializes generate calls so only one turn consumes notifications at a time', async () => {
  let index = 0;
  const transport = createQueueTransport({
    'thread/start': () => ({ thread: { id: `thr_${++index}` } }),
    'turn/start': (params) => ({ turn: { id: params.threadId.replace('thr', 'turn') } }),
  });
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });

  const first = client.generate({ prompt: 'one' });
  await tick();
  const second = client.generate({ prompt: 'two' });
  await tick();

  assert.equal(countCalls(transport, 'turn/start'), 1);
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_1', turnId: 'turn_1' },
  });
  assert.deepEqual(await first, { threadId: 'thr_1', text: '' });
  await tick();
  assert.equal(countCalls(transport, 'turn/start'), 2);
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_2', turnId: 'turn_2' },
  });
  assert.deepEqual(await second, { threadId: 'thr_2', text: '' });
});

test('requires thread and turn ids returned by app server requests', async () => {
  const missingThread = createCodexAppClient({
    transport: createQueueTransport({ 'thread/start': () => ({}) }),
  });
  await assert.rejects(
    () => missingThread.generate({ prompt: 'hello' }),
    /thread\/start did not return a threadId/,
  );

  const missingTurn = createCodexAppClient({
    transport: createQueueTransport({ 'turn/start': () => ({}) }),
  });
  await assert.rejects(
    () => missingTurn.generate({ prompt: 'hello', threadId: 'thr_1' }),
    /turn\/start did not return a turnId/,
  );
});

test('accepts flat thread and turn ids for transport compatibility', async () => {
  const transport = createQueueTransport({
    'thread/start': () => ({ threadId: 'thr_flat' }),
    'turn/start': () => ({ turnId: 'turn_flat' }),
  });
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });
  const generated = client.generate({ prompt: 'hello' });

  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'thr_flat', turnId: 'turn_flat', delta: 'ok' },
  });
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_flat', turnId: 'turn_flat' },
  });

  assert.deepEqual(await generated, { threadId: 'thr_flat', text: 'ok' });
});

test('accepts nested turn id in completion notifications', async () => {
  const transport = createQueueTransport();
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });
  const generated = client.generate({ prompt: 'hello' });

  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'ok' },
  });
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_1', turn: { id: 'turn_1' } },
  });

  assert.deepEqual(await generated, { threadId: 'thr_1', text: 'ok' });
});

test('ignores completion notifications without exact thread and turn ids', async () => {
  const transport = createQueueTransport();
  const client = createCodexAppClient({ transport, cwd: 'C:\\repo' });
  const generated = client.generate({ prompt: 'hello' });

  transport.push({ method: 'turn/completed', params: { threadId: 'thr_1' } });
  transport.push({ method: 'turn/completed', params: { turnId: 'turn_1' } });
  transport.push({
    method: 'item/agentMessage/delta',
    params: { threadId: 'thr_1', turnId: 'turn_1', delta: 'ok' },
  });
  transport.push({
    method: 'turn/completed',
    params: { threadId: 'thr_1', turnId: 'turn_1' },
  });

  assert.deepEqual(await generated, { threadId: 'thr_1', text: 'ok' });
});

test('retries initialization after a failed initialize request', async () => {
  let initializeAttempts = 0;
  const transport = createQueueTransport({
    initialize: () => {
      initializeAttempts += 1;
      if (initializeAttempts === 1) throw new Error('temporary init failure');
      return { protocolVersion: 1 };
    },
  });
  const client = createCodexAppClient({ transport });

  await assert.rejects(() => client.readAccount(), /temporary init failure/);
  assert.deepEqual(await client.readAccount(), { id: 'acct_1' });
  assert.equal(initializeAttempts, 2);
});
