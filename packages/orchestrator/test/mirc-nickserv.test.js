const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '../../..');

test('mirc helper includes NickServ shortcuts', () => {
  const script = readFileSync(join(repoRoot, 'clients/mirc/eduardoirc.mrc'), 'utf8');

  assert.match(script, /alias ns-identify /);
  assert.match(script, /alias ns-register /);
  assert.match(script, /msg NickServ IDENTIFY/);
});

test('mirc docs explain reserved nickname recovery', () => {
  const readme = readFileSync(join(repoRoot, 'clients/mirc/README.md'), 'utf8');

  assert.match(readme, /NICKNAME_RESERVED/);
  assert.match(readme, /\/ns-identify/);
});
