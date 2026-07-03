const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canAgentUseCapability,
  blockedCapabilities,
} = require('../src/permissions');

test('allows v0 communication capabilities', () => {
  assert.equal(canAgentUseCapability('manager-agent', 'reply'), true);
  assert.equal(canAgentUseCapability('coder-agent', 'update_status'), true);
});

test('blocks execution capabilities for every agent', () => {
  for (const capability of blockedCapabilities) {
    assert.equal(canAgentUseCapability('coder-agent', capability), false);
  }
});

test('does not allow unknown capabilities', () => {
  assert.equal(canAgentUseCapability('qa-agent', 'unknown'), false);
});
