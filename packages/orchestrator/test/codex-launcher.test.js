const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const launcherPath = join(__dirname, '../../../scripts/start-helper.ps1');

test('launcher avoids Start-Process environment duplication bug', () => {
  const script = readFileSync(launcherPath, 'utf8');

  assert.doesNotMatch(script, /Start-Process/);
  assert.match(script, /cmd\.exe/);
  assert.match(script, /--nick/);
  assert.match(script, /helper/);
  assert.match(script, /start/);
});

test('old codex-agent launcher delegates to helper launcher', () => {
  const script = readFileSync(join(__dirname, '../../../scripts/start-codex-agent.ps1'), 'utf8');

  assert.match(script, /start-helper\.ps1/);
});
