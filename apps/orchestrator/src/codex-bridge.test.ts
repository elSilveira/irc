import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODEX_BRIDGE_INSTRUCTIONS } from './codex-bridge.js';

test('Codex bridge instructions advertise external write tools', () => {
  assert.match(CODEX_BRIDGE_INSTRUCTIONS, /IRC_TOOL/);
  assert.match(CODEX_BRIDGE_INSTRUCTIONS, /write_file/);
  assert.doesNotMatch(CODEX_BRIDGE_INSTRUCTIONS, /READ-ONLY/i);
  assert.doesNotMatch(CODEX_BRIDGE_INSTRUCTIONS, /cannot edit/i);
});
