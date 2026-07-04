import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireRuntimeGuardian } from './runtime-guardian.js';

function tempLock(): string {
  return join(mkdtempSync(join(tmpdir(), 'orc-guardian-')), 'orchestrator.lock');
}

test('blocks a second live orchestrator runtime', () => {
  const lockPath = tempLock();
  const first = acquireRuntimeGuardian({
    lockPath,
    processId: 111,
    isProcessAlive: (pid) => pid === 111,
  });

  assert.throws(
    () => acquireRuntimeGuardian({ lockPath, processId: 222, isProcessAlive: (pid) => pid === 111 }),
    /orchestrator already running as pid 111/,
  );

  first.release();
  assert.throws(() => readFileSync(lockPath), /ENOENT/);
});

test('replaces a stale orchestrator lock', () => {
  const lockPath = tempLock();
  writeFileSync(lockPath, '{"pid":111,"startedAt":"old"}\n', 'utf8');

  const guardian = acquireRuntimeGuardian({
    lockPath,
    processId: 222,
    isProcessAlive: () => false,
  });

  assert.match(readFileSync(lockPath, 'utf8'), /"pid":222/);
  guardian.release();
  assert.throws(() => readFileSync(lockPath), /ENOENT/);
});

test('blocks duplicate starts in the same process', () => {
  const lockPath = tempLock();
  const first = acquireRuntimeGuardian({ lockPath, processId: 111, isProcessAlive: () => false });

  assert.throws(
    () => acquireRuntimeGuardian({ lockPath, processId: 111, isProcessAlive: () => false }),
    /orchestrator already running as pid 111/,
  );

  first.release();
});

test('release leaves another runtime lock alone', () => {
  const lockPath = tempLock();
  const guardian = acquireRuntimeGuardian({ lockPath, processId: 111, isProcessAlive: () => false });
  writeFileSync(lockPath, '{"pid":222,"startedAt":"new"}\n', 'utf8');

  guardian.release();

  assert.match(readFileSync(lockPath, 'utf8'), /"pid":222/);
  rmSync(lockPath, { force: true });
});
