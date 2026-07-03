const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const scriptPath = join(__dirname, '../../../clients/mirc/eduardoirc.mrc');

test('defines control-plane shortcut aliases', () => {
  const script = readFileSync(scriptPath, 'utf8');

  for (const alias of [
    'orc-agent-create',
    'orc-agents',
    'orc-new',
    'orc-status',
    'orc-tasks',
    'orc-join',
    'orc-summarize',
  ]) {
    assert.match(script, new RegExp(`alias ${alias} `));
  }
});

test('documents agent context argument in mIRC helper', () => {
  const readmePath = join(__dirname, '../../../clients/mirc/README.md');
  const readme = readFileSync(readmePath, 'utf8');

  assert.match(readme, /\/orc-agent-create researcher-agent/);
  assert.match(readme, /context/);
});
