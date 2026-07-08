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

test('allows BotService restart permissions', () => {
  assert.equal(canAgentUseCapability('BotService', 'service_restart'), true);
  assert.equal(canAgentUseCapability('BotService', 'docker_update'), true);
});

test('blocks unsafe execution capabilities for every agent', () => {
  for (const capability of blockedCapabilities) {
    assert.equal(canAgentUseCapability('coder-agent', capability), false);
  }
});

test('does not allow unknown capabilities', () => {
  assert.equal(canAgentUseCapability('qa-agent', 'unknown'), false);
});
