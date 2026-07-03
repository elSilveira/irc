const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const {
  createCodexRpcTransport,
  createCodexSpawnConfig,
} = require('../src/codex-rpc-transport');

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => {};
  child.stdin.on('error', () => {});
  child.stdout.on('error', () => {});
  return child;
}

test('rejects pending requests with stderr diagnostics on child exit', async () => {
  const child = createFakeChild();
  const transport = createCodexRpcTransport({ child });
  const pending = transport.request('initialize', {}, 50);

  child.stderr.write('fatal: bad credentials\n');
  child.emit('exit', 1);

  await assert.rejects(pending, /codex app-server exited.*fatal: bad credentials/s);
});

test('rejects pending requests when stdout emits an error', async () => {
  const child = createFakeChild();
  const transport = createCodexRpcTransport({ child });
  const pending = transport.request('initialize', {}, 50);

  child.stdout.emit('error', new Error('stdout failed'));

  await assert.rejects(pending, /stdout failed/);
});

test('rejects pending requests when stdin emits an error', async () => {
  const child = createFakeChild();
  const transport = createCodexRpcTransport({ child });
  const pending = transport.request('initialize', {}, 50);

  child.stdin.emit('error', new Error('stdin failed'));

  await assert.rejects(pending, /stdin failed/);
});

test('rejects pending requests when stdout contains invalid JSON', async () => {
  const child = createFakeChild();
  const transport = createCodexRpcTransport({ child });
  const pending = transport.request('initialize', {}, 50);

  child.stderr.write('near startup\n');
  child.stdout.write('not-json\n');

  await assert.rejects(pending, /Invalid JSON from codex app-server.*near startup/s);
});

test('uses the cmd shim for codex on Windows', () => {
  assert.deepEqual(createCodexSpawnConfig({ platform: 'win32' }), {
    command: 'codex.cmd',
    args: ['app-server'],
    shell: true,
  });
});
