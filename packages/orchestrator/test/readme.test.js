const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('documents Codex app-server IRC workflow', () => {
  const readme = readFileSync(join(__dirname, '../../../README.md'), 'utf8');

  assert.match(readme, /codex app-server/i);
  assert.match(readme, /\/codex-login/);
  assert.match(readme, /direct messages/i);
  assert.match(readme, /@orc new/);
  assert.match(readme, /#task-0001/);
});
