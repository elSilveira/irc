const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const launcherPath = join(__dirname, '../../../scripts/start-codex-agent.ps1');

test('launcher avoids Start-Process environment duplication bug', () => {
  const script = readFileSync(launcherPath, 'utf8');

  assert.doesNotMatch(script, /Start-Process/);
  assert.match(script, /cmd\.exe/);
  assert.match(script, /CODEX_IRC_NICK/);
  assert.match(script, /start/);
});
