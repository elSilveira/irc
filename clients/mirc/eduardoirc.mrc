; EduardoIRC mIRC helper
; Load in mIRC with: /load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
; Then run: /eduardoirc
; Control-plane aliases send @orc commands to #control.

alias eduardoirc {
  echo -a Connecting to EduardoIRC locally without TLS...
  server -m 127.0.0.1:6667
}

alias eduardoirc-lan {
  echo -a Connecting to EduardoIRC on the LAN with TLS...
  server -m 192.168.68.57:+6697
}

alias eduardoirc-public {
  echo -a Connecting to EduardoIRC public DNS with TLS...
  server -m irc.eduardosilveira.dev:+6697
}

alias ns-identify {
  if (!$1) { echo -a Usage: /ns-identify <account-password> | return }
  msg NickServ IDENTIFY $1-
}

alias ns-register {
  if (!$1) { echo -a Usage: /ns-register <new-password> | return }
  msg NickServ REGISTER $1-
}

alias use-nick {
  if (!$1) { echo -a Usage: /use-nick <nickname> | return }
  nick $1
}

alias codex-status { msg #control @codex status }
alias codex-help { msg #control @codex help }
alias codex-login { msg #control @codex login }

alias codex-echo {
  if (!$1) { echo -a Usage: /codex-echo <text> | return }
  msg #control @codex echo $1-
}

alias botserv-help { msg BotService HELP }

alias botserv-new {
  if (!$1) { echo -a Usage: /botserv-new <task title> | return }
  msg BotService NEW $qt($1-)
}

alias orc-agents { msg #control @orc agents }
alias orc-status { msg #control @orc status }
alias orc-tasks { msg #control @orc tasks }
alias orc-skills-command { msg #control @orc skills }

alias orc-skills {
  if (!$dialog(eduardoirc_skills)) { dialog -m eduardoirc_skills eduardoirc_skills }
  else { dialog -v eduardoirc_skills }
}

alias orc-skill-help { msg BotService HELP SKILLS }

alias orc-skill-use {
  if (!$1) { echo -a Usage: /orc-skill-use <skill> <request> | return }
  if (!$2) { msg #control @orc agents | return }
  msg #control @orc new $qt($1-)
}

alias orc-new {
  if (!$1) { echo -a Usage: /orc-new <task title> | return }
  msg #control @orc new $qt($1-)
}

alias project {
  if (!$1) { echo -a Usage: /project connect <#channel> <workspace> | return }
  msg $iif($chan,$chan,#control) @orc project $1-
}

alias orc-agent-create {
  if (!$4) { echo -a Usage: /orc-agent-create <id> <nick> <role> <context> | return }
  msg #control @orc agent create $1 --nick $2 --role $3 --context $qt($4-)
}

alias orc-assign {
  if (!$2) { echo -a Usage: /orc-assign <task-id> <agent-id> | return }
  msg #control @orc assign $1 $2
}

alias orc-join {
  if (!$2) { echo -a Usage: /orc-join <task-id> <agent-id> | return }
  msg #control @orc join $1 $2
}

alias orc-summarize {
  if (!$1) { echo -a Usage: /orc-summarize <task-id> | return }
  msg #control @orc summarize $1
}

alias orc-logs {
  if (!$1) { echo -a Usage: /orc-logs <task-id> | return }
  msg #control @orc logs $1
}

dialog eduardoirc_skills {
  title "EduardoIRC Skills"
  size -1 -1 280 216
  option dbu
  text "Skills", 1, 8 7 42 8
  list 10, 8 18 126 154, size hsbar
  box "Interact", 20, 142 18 130 154
  text "Skill", 21, 150 31 42 8
  edit "", 23, 150 42 112 12, autohs
  text "Request", 41, 150 58 42 8
  edit "", 22, 150 69 112 12, autohs
  text "Description / detail", 42, 150 86 70 8
  edit "", 24, 150 97 112 42, multi return autovs vsbar
  button "Create task", 30, 150 146 52 14
  button "Agents", 31, 210 146 52 14
  button "Skill help", 32, 150 164 52 14
  button "Refresh", 33, 210 164 52 14
  text "Select a skill to view its description; edit the skill or detail before creating a task.", 40, 8 181 254 16
  button "Close", 2, 220 196 52 16, ok
}

on *:dialog:eduardoirc_skills:init:0:{
  did -a eduardoirc_skills 10 implementation: Builds scoped features and fixes with focused production edits.
  did -a eduardoirc_skills 10 tdd: Adds or updates tests before implementation changes.
  did -a eduardoirc_skills 10 repo-editing: Reads, writes, and keeps code changes limited to the assigned repo task.
  did -a eduardoirc_skills 10 qa: Validates completed work against the requested behavior.
  did -a eduardoirc_skills 10 testing: Runs targeted checks and reports actionable failures.
  did -a eduardoirc_skills 10 review: Reviews code for regressions, risks, and missing coverage.
  did -a eduardoirc_skills 10 orchestration: Coordinates agents, task state, and handoffs.
  did -a eduardoirc_skills 10 planning: Breaks requested work into concrete execution steps.
  did -a eduardoirc_skills 10 routing: Selects the right agent or channel for incoming work.
  did -a eduardoirc_skills 10 research: Finds project context and supporting references before changes.
  did -a eduardoirc_skills 10 docs: Updates written project guidance and user-facing docs.
  did -a eduardoirc_skills 10 context: Collects and preserves relevant task, repo, and conversation context.
  did -a eduardoirc_skills 10 ops: Handles runtime, deployment, and service operation tasks.
  did -a eduardoirc_skills 10 logs: Inspects logs and traces to diagnose current behavior.
  did -a eduardoirc_skills 10 diagnostics: Investigates failures and narrows them to likely causes.
}

on *:dialog:eduardoirc_skills:sclick:*:{
  if ($did == 10) {
    var %line = $did(eduardoirc_skills,10).seltext
    if (%line) {
      did -ra eduardoirc_skills 23 $gettok(%line,1,58)
      did -ra eduardoirc_skills 24 $gettok(%line,2-,58)
    }
  }
  if ($did == 30) {
    var %skill = $did(eduardoirc_skills,23).text
    var %request = $did(eduardoirc_skills,22).text
    var %detail = $did(eduardoirc_skills,24).text
    if (!%skill) { var %skill = $gettok($did(eduardoirc_skills,10).seltext,1,58) }
    if (!%skill) { echo -a Select or enter a skill first. | return }
    if (!%request) { echo -a Enter a request first. | return }
    if (%detail) { msg #control @orc new $qt(%skill $+ : %request %detail) }
    else { msg #control @orc new $qt(%skill $+ : %request) }
  }
  if ($did == 31) { msg #control @orc agents }
  if ($did == 32) { msg BotService HELP SKILLS }
  if ($did == 33) { msg #control @orc skills }
}

menu status {
  EduardoIRC
  .Connect local:/eduardoirc
  .Connect LAN:/eduardoirc-lan
  .Connect public:/eduardoirc-public
  .NickServ
  ..Identify:/ns-identify password
  ..Register:/ns-register password
  .Codex agent
  ..Status:/codex-status
  ..Help:/codex-help
  ..Login:/codex-login
  .BotService
  ..Help:/botserv-help
  ..New task:/botserv-new test task
  .Control plane
  ..Agents:/orc-agents
  ..Skills modal:/orc-skills
  ..Skill list:/orc-skills-command
  ..Skill help:/orc-skill-help
  ..Status:/orc-status
  ..Tasks:/orc-tasks
  ..New task:/orc-new test task
}
