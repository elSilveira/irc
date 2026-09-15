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

test("project alias sends project commands to the orchestrator", () => {
  assert.match(helperScript, /alias project \{/);
  assert.match(helperScript, /Usage: \/project connect <#channel> <workspace>/);
  assert.match(helperScript, /msg \$iif\(\$chan,\$chan,#control\) @orc project \$1-/);
});

test("agents modal refreshes from actual orchestrator output and loads context", () => {
  assert.match(helperScript, /alias agents \{/);
  assert.match(helperScript, /on \*:dialog:eduardoirc_agents:init:0:\{/);
  assert.match(helperScript, /did -r eduardoirc_agents 10 \| msg #control @orc agents/);
  assert.doesNotMatch(helperScript, /did -a eduardoirc_agents 10 feature-implementer/);
  assert.match(helperScript, /on \*:TEXT:Agents:\*:#control:\{/);
  assert.match(helperScript, /did -r eduardoirc_agents 10/);
  assert.match(helperScript, /did -a eduardoirc_agents 10 %row/);
  assert.match(helperScript, /text "Channels", 45/);
  assert.match(helperScript, /edit "", 25, .*autohs/);
  assert.match(helperScript, /\$regex\(agentctx,%line,\/context="\(\[\^"\]\*\)"\//);
  assert.match(helperScript, /did -ra eduardoirc_agents 31 \$regml\(agentctx,1\)/);
  assert.match(helperScript, /msg #control @orc agent update %id --nick %nick --role %role --context \$qt\(%context\) --skills %skills --channels %channels/);
});

test("agents modal appends continuation rows from chunked orchestrator output", () => {
  assert.match(helperScript, /on \*:TEXT:Agents:\*:#control:\{/);
  assert.match(helperScript, /on \*:TEXT:\*:#control:\{/);
  assert.match(helperScript, /set %eduardoirc_agents_loading 1/);
  assert.match(helperScript, /unset %eduardoirc_agents_loading/);
  assert.match(helperScript, /if \(%eduardoirc_agents_loading && \$dialog\(eduardoirc_agents\) && \$chr\(124\) isin \$1-\)/);
});

test("agents modal exposes selectable skills beside the editable skills field", () => {
  assert.match(helperScript, /list 60, .*size hsbar/);
  assert.match(helperScript, /button "Add skill", 61/);
  assert.match(helperScript, /button "Clear skills", 62/);
  assert.match(helperScript, /on \*:dialog:eduardoirc_agents:init:0:\{ did -r eduardoirc_agents 10 \| did -r eduardoirc_agents 60/);
  assert.match(helperScript, /did -a eduardoirc_agents 60 implementation: Builds scoped features/);
  assert.match(helperScript, /var %skill = \$gettok\(\$did\(eduardoirc_agents,60\)\.seltext,1,58\)/);
  assert.match(helperScript, /did -ra eduardoirc_agents 29 \$addtok\(%skills,%skill,44\)/);
  assert.match(helperScript, /if \(\$did == 62\) \{ did -r eduardoirc_agents 29 \}/);
});
