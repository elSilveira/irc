import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canUseCapability, ALLOWED_CAPABILITIES, BLOCKED_CAPABILITIES } from './permissions.js';

test('allows read and agent management capabilities', () => {
  assert.deepEqual(canUseCapability('orchestrator', 'list_files'), { ok: true });
  assert.deepEqual(canUseCapability('orchestrator', 'manage_agents'), { ok: true });
});

test('blocks execution capabilities', () => {
  assert.equal(canUseCapability('orchestrator', 'shell').ok, false);
  assert.equal(canUseCapability('orchestrator', 'deploy').ok, false);
});

test('rejects unknown agents', () => {
  assert.equal(canUseCapability(undefined, 'list_files').ok, false);
});

test('rejects unknown capabilities', () => {
  assert.equal(canUseCapability('orchestrator', 'fly_to_moon').ok, false);
});

test('allowed and blocked lists are disjoint', () => {
  for (const cap of ALLOWED_CAPABILITIES) {
    assert.ok(!BLOCKED_CAPABILITIES.includes(cap), `${cap} appears in both lists`);
  }
});
