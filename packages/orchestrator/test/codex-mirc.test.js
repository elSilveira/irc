const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '../../..');

test('mirc helper has codex shortcuts', () => {
  const script = readFileSync(join(repoRoot, 'clients/mirc/eduardoirc.mrc'), 'utf8');

  assert.match(script, /alias codex-status /);
  assert.match(script, /alias codex-help /);
  assert.match(script, /alias codex-login /);
  assert.match(script, /@codex status/);
  assert.match(script, /@codex login/);
  assert.match(script, /alias botserv-help /);
  assert.match(script, /alias botserv-new /);
  assert.match(script, /msg BotServ HELP/);
});

test('mirc docs explain codex-agent commands', () => {
  const readme = readFileSync(join(repoRoot, 'clients/mirc/README.md'), 'utf8');

  assert.match(readme, /codex-agent/);
  assert.match(readme, /\/codex-status/);
  assert.match(readme, /\/codex-login/);
  assert.match(readme, /direct messages/i);
  assert.match(readme, /codex app-server/i);
  assert.match(readme, /@orc new/);
  assert.match(readme, /BotServ/);
  assert.match(readme, /\/botserv-new/);
});
