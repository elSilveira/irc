import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const helperScript = readFileSync(join(process.cwd(), "clients/mirc/eduardoirc.mrc"), "utf8");

test("skills modal lets users edit skill name and add detail", () => {
  assert.match(helperScript, /edit "", 23, .*autohs/);
  assert.match(helperScript, /text "Description \/ detail", 42/);
  assert.match(helperScript, /edit "", 24, .*multi/);
  assert.match(helperScript, /did -ra eduardoirc_skills 23 \$gettok\(%line,1,58\)/);
  assert.match(helperScript, /did -ra eduardoirc_skills 24 \$gettok\(%line,2-,58\)/);
  assert.match(helperScript, /var %detail = \$did\(eduardoirc_skills,24\)\.text/);
  assert.match(helperScript, /msg #control @orc new \$qt\(%skill \$\+ : %request %detail/);
});

test("skills modal shows descriptions for every skill", () => {
  for (const skill of ["implementation", "tdd", "repo-editing", "qa", "testing", "review", "orchestration", "planning", "routing", "research", "docs", "context", "ops", "logs", "diagnostics"]) {
    assert.match(helperScript, new RegExp(`did -a eduardoirc_skills 10 ${skill}: .+\\.`));
  }
});
