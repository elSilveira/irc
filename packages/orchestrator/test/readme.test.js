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
  assert.match(readme, /BotService/);
  assert.match(readme, /\/msg BotService NEW/);
});

test('documents orchestrator app and package split', () => {
  const repoRoot = join(__dirname, '../../..');
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const architecture = readFileSync(join(repoRoot, 'docs/architecture.md'), 'utf8');

  for (const doc of [readme, architecture]) {
    assert.match(doc, /packages\/orchestrator/);
    assert.match(doc, /apps\/orchestrator/);
    assert.match(doc, /Legacy CommonJS/i);
    assert.match(doc, /TypeScript global orchestrator/i);
  }
});
