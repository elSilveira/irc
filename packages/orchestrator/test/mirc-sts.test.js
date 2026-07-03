const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '../../..');

test('local ergo config does not advertise STS', () => {
  const config = readFileSync(join(repoRoot, 'config/ergo/ircd.yaml'), 'utf8');

  assert.match(config, /sts:\s*\r?\n\s+enabled: false/);
});

test('clear script removes mIRC STS cache entries', () => {
  const script = readFileSync(join(repoRoot, 'scripts/clear-mirc-sts.ps1'), 'utf8');

  assert.match(script, /servers\.ini/);
  assert.match(script, /\\\[sts\\\]/);
  assert.match(script, /127\.0\.0\.1/);
  assert.match(script, /Copy-Item/);
});

test('mirc docs mention clearing cached STS upgrades', () => {
  const readme = readFileSync(join(repoRoot, 'clients/mirc/README.md'), 'utf8');

  assert.match(readme, /Using STS secure port/);
  assert.match(readme, /clear-mirc-sts\.ps1/);
});
