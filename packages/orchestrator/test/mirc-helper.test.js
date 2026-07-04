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

test('defines skills modal dialog and interaction aliases', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.match(script, /dialog eduardoirc_skills/);
  assert.match(script, /alias orc-skills/);
  assert.match(script, /alias orc-skill-help/);
  assert.match(script, /did -a eduardoirc_skills 10/);
  assert.match(script, /on \*:dialog:eduardoirc_skills:sclick:/);
  assert.match(script, /msg #control @orc skills/);
  assert.match(script, /msg BotService HELP SKILLS/);
});

test('skills modal allows editing skill and adding detail to task request', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.match(script, /edit "", 23, .*autohs/);
  assert.match(script, /text "Description \/ detail", 42/);
  assert.match(script, /edit "", 24, .*multi return autovs vsbar/);
  assert.match(script, /did -ra eduardoirc_skills 23 \$gettok\(%line,1,58\)/);
  assert.match(script, /did -ra eduardoirc_skills 24 \$gettok\(%line,2-,58\)/);
  assert.match(script, /var %skill = \$did\(eduardoirc_skills,23\)\.text/);
  assert.match(script, /var %detail = \$did\(eduardoirc_skills,24\)\.text/);
  assert.match(script, /if \(%detail\) \{ msg #control @orc new \$qt\(%skill \$\+ : %request %detail\) \}/);
});

test('documents agent context argument in mIRC helper', () => {
  const readmePath = join(__dirname, '../../../clients/mirc/README.md');
  const readme = readFileSync(readmePath, 'utf8');

  assert.match(readme, /\/orc-agent-create researcher-agent/);
  assert.match(readme, /context/);
});
