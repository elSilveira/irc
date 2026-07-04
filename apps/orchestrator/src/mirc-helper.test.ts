import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const helperScript = readFileSync(join(process.cwd(), "clients/mirc/eduardoirc.mrc"), "utf8");

test("skills modal lets users edit skill name and add detail", () => {
  assert.match(helperScript, /edit "", 23, .*autohs/);
  assert.match(helperScript, /edit "", 24, .*multi/);
  assert.match(helperScript, /did -ra eduardoirc_skills 23 %skill/);
  assert.match(helperScript, /var %detail = \$did\(eduardoirc_skills,24\)\.text/);
  assert.match(helperScript, /msg #control @orc new \$qt\(%skill \$\+ : %request %detail/);
});
