; EduardoIRC mIRC helper
; Load in mIRC with: /load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
; Then run: /eduardoirc
; Control-plane aliases send @orc commands to #control.

alias eduardoirc { echo -a Connecting to EduardoIRC locally without TLS... | server -m 127.0.0.1:6667 }
alias eduardoirc-lan { echo -a Connecting to EduardoIRC on the LAN with TLS... | server -m 192.168.68.57:+6697 }
alias eduardoirc-public { echo -a Connecting to EduardoIRC public DNS with TLS... | server -m irc.eduardosilveira.dev:+6697 }
alias startbot { echo -a Starting EduardoIRC services; managed agents will return after orchestrator reconcile... | run -n powershell.exe -NoProfile -ExecutionPolicy Bypass -File $qt(C:\Users\duzit\source\irc\scripts\restart-service.ps1) }
alias ns-identify { if (!$1) { echo -a Usage: /ns-identify <account-password> | return } | msg NickServ IDENTIFY $1- }
alias ns-register { if (!$1) { echo -a Usage: /ns-register <new-password> | return } | msg NickServ REGISTER $1- }
alias use-nick { if (!$1) { echo -a Usage: /use-nick <nickname> | return } | nick $1 }
alias codex-status { msg #control @codex status }
alias codex-help { msg #control @codex help }
alias codex-login { msg #control @codex login }
alias codex-echo { if (!$1) { echo -a Usage: /codex-echo <text> | return } | msg #control @codex echo $1- }
alias botserv-help { msg BotService HELP }
alias botserv-new { if (!$1) { echo -a Usage: /botserv-new <task title> | return } | msg BotService NEW $qt($1-) }
alias orc-agents { agents }
alias orc-status { msg #control @orc status }
alias orc-tasks { msg #control @orc tasks }
alias orc-skills-command { msg #control @orc skills $1- }
alias orc-skill-help { msg BotService HELP SKILLS }
alias orc-new { if (!$1) { echo -a Usage: /orc-new <task title> | return } | msg #control @orc new $qt($1-) }
alias orc-assign { if (!$2) { echo -a Usage: /orc-assign <task-id> <agent-id> | return } | msg #control @orc assign $1 $2 }
alias orc-join { if (!$2) { echo -a Usage: /orc-join <#channel> <agent-id|all> | return } | msg #control @orc join $1 $2 }
alias orc-summarize { if (!$1) { echo -a Usage: /orc-summarize <task-id> | return } | msg #control @orc summarize $1 }
alias orc-logs { if (!$1) { echo -a Usage: /orc-logs <task-id> | return } | msg #control @orc logs $1 }
alias project { if (!$1) { echo -a Usage: /project connect <#channel> <workspace> | return } | msg $iif($chan,$chan,#control) @orc project $1- }
alias orc-agent-create { if (!$4) { echo -a Usage: /orc-agent-create <id> <nick> <role> <context> | return } | msg #control @orc agent create $1 --nick $2 --role $3 --context $qt($4-) }
alias skills { if (!$dialog(eduardoirc_skills)) { dialog -m eduardoirc_skills eduardoirc_skills } | else { dialog -v eduardoirc_skills } }
alias orc-skills { skills }
alias agents { set %eduardoirc_agents_loading 1 | if (!$dialog(eduardoirc_agents)) { dialog -m eduardoirc_agents eduardoirc_agents } | else { dialog -v eduardoirc_agents | did -r eduardoirc_agents 10 | msg #control @orc agents } }

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
  if ($did == 10) { var %line = $did(eduardoirc_skills,10).seltext | if (%line) { did -ra eduardoirc_skills 23 $gettok(%line,1,58) | did -ra eduardoirc_skills 24 $gettok(%line,2-,58) } }
  if ($did == 30) { var %skill = $did(eduardoirc_skills,23).text | var %request = $did(eduardoirc_skills,22).text | var %detail = $did(eduardoirc_skills,24).text | if (!%skill) { var %skill = $gettok($did(eduardoirc_skills,10).seltext,1,58) } | if (!%skill) { echo -a Select or enter a skill first. | return } | if (!%request) { echo -a Enter a request first. | return } | if (%detail) { msg #control @orc new $qt(%skill $+ : %request %detail) } | else { msg #control @orc new $qt(%skill $+ : %request) } }
  if ($did == 31) { agents }
  if ($did == 32) { msg BotService HELP SKILLS }
  if ($did == 33) { msg #control @orc skills }
}

dialog eduardoirc_agents {
  title "EduardoIRC Agents"
  size -1 -1 390 252
  option dbu
  text "Agents", 1, 8 7 42 8
  list 10, 8 18 142 186, size hsbar
  box "Config", 20, 158 18 122 186
  text "ID", 21, 166 31 30 8
  edit "", 22, 204 30 66 12, autohs
  text "Nick", 23, 166 47 30 8
  edit "", 24, 204 46 66 12, autohs
  text "Channels", 45, 166 63 42 8
  edit "", 25, 204 62 66 12, autohs
  text "Role", 26, 166 79 30 8
  edit "", 27, 204 78 66 12, autohs
  text "Skills", 28, 166 95 30 8
  edit "", 29, 204 94 66 12, autohs
  text "Prompt", 30, 166 111 42 8
  edit "", 31, 204 110 66 46, multi return autovs vsbar
  button "Create", 40, 166 164 34 14
  button "Update", 41, 204 164 34 14
  button "Delete", 43, 242 164 34 14
  button "Refresh", 42, 204 182 46 14
  box "Skills", 59, 286 18 96 186
  list 60, 294 31 80 126, size hsbar
  button "Add skill", 61, 294 164 38 14
  button "Clear skills", 62, 336 164 38 14
  text "Refresh loads current configs from @orc. Select a line, edit fields, then create, update, or delete.", 50, 8 210 366 16
  button "Close", 2, 330 230 52 16, ok
}

on *:dialog:eduardoirc_agents:init:0:{ did -r eduardoirc_agents 10 | did -r eduardoirc_agents 60 | did -a eduardoirc_agents 60 implementation: Builds scoped features and fixes with focused production edits. | did -a eduardoirc_agents 60 tdd: Adds or updates tests before implementation changes. | did -a eduardoirc_agents 60 repo-editing: Reads, writes, and keeps code changes limited to the assigned repo task. | did -a eduardoirc_agents 60 qa: Validates completed work against the requested behavior. | did -a eduardoirc_agents 60 testing: Runs targeted checks and reports actionable failures. | did -a eduardoirc_agents 60 review: Reviews code for regressions, risks, and missing coverage. | did -a eduardoirc_agents 60 orchestration: Coordinates agents, task state, and handoffs. | did -a eduardoirc_agents 60 planning: Breaks requested work into concrete execution steps. | did -a eduardoirc_agents 60 routing: Selects the right agent or channel for incoming work. | did -a eduardoirc_agents 60 research: Finds project context and supporting references before changes. | did -a eduardoirc_agents 60 docs: Updates written project guidance and user-facing docs. | did -a eduardoirc_agents 60 context: Collects and preserves relevant task, repo, and conversation context. | did -a eduardoirc_agents 60 ops: Handles runtime, deployment, and service operation tasks. | did -a eduardoirc_agents 60 logs: Inspects logs and traces to diagnose current behavior. | did -a eduardoirc_agents 60 diagnostics: Investigates failures and narrows them to likely causes. | set %eduardoirc_agents_loading 1 | msg #control @orc agents }

on *:TEXT:Agents:*:#control:{
  if (!$dialog(eduardoirc_agents)) { return }
  did -r eduardoirc_agents 10
  set %eduardoirc_agents_loading 1
  var %payload = $mid($1-,9)
  var %i = 1
  while ($gettok(%payload,%i,124)) { var %row = $v1 | did -a eduardoirc_agents 10 %row | inc %i }
}

on *:TEXT:*:#control:{
  if (%eduardoirc_agents_loading && $dialog(eduardoirc_agents) && $chr(124) isin $1-) {
    if ($left($1-,7) == Agents:) { return }
    var %i = 1
    while ($gettok($1-,%i,124)) { var %row = $v1 | did -a eduardoirc_agents 10 %row | inc %i }
    return
  }
  if (%eduardoirc_agents_loading && $dialog(eduardoirc_agents)) { unset %eduardoirc_agents_loading }
}

on *:dialog:eduardoirc_agents:sclick:*:{
  if ($did == 10) { var %line = $did(eduardoirc_agents,10).seltext | if (%line) { did -ra eduardoirc_agents 22 $gettok(%line,1,32) | did -ra eduardoirc_agents 24 $remove($gettok($matchtok(%line,nick=*,1,32),2,61),$chr(34)) | did -ra eduardoirc_agents 27 $remove($gettok($matchtok(%line,role=*,1,32),2,61),$chr(34)) | did -ra eduardoirc_agents 25 $remove($gettok($matchtok(%line,channels=*,1,32),2,61),$chr(34),$chr(40),$chr(41),none) | did -ra eduardoirc_agents 29 $remove($gettok($matchtok(%line,skills=*,1,32),2,61),$chr(34),$chr(40),$chr(41),none) | if ($regex(agentctx,%line,/context="([^"]*)"/)) { did -ra eduardoirc_agents 31 $regml(agentctx,1) } } }
  if ($did == 40) { var %id = $did(eduardoirc_agents,22).text | var %nick = $did(eduardoirc_agents,24).text | var %role = $did(eduardoirc_agents,27).text | var %channels = $did(eduardoirc_agents,25).text | var %skills = $did(eduardoirc_agents,29).text | var %context = $did(eduardoirc_agents,31).text | if (!%id || !%nick || !%role || !%context) { echo -a Fill id, nick, role, and prompt before creating. | return } | msg #control @orc agent create %id --nick %nick --role %role --context $qt(%context) --skills %skills --channels %channels }
  if ($did == 41) { var %id = $did(eduardoirc_agents,22).text | var %nick = $did(eduardoirc_agents,24).text | var %role = $did(eduardoirc_agents,27).text | var %channels = $did(eduardoirc_agents,25).text | var %skills = $did(eduardoirc_agents,29).text | var %context = $did(eduardoirc_agents,31).text | if (!%id || !%context) { echo -a Select an agent and keep prompt populated before updating. | return } | msg #control @orc agent update %id --nick %nick --role %role --context $qt(%context) --skills %skills --channels %channels }
  if ($did == 42) { did -r eduardoirc_agents 10 | set %eduardoirc_agents_loading 1 | msg #control @orc agents }
  if ($did == 43) { var %id = $did(eduardoirc_agents,22).text | if (!%id) { echo -a Select an agent before deleting. | return } | msg #control @orc agent delete %id | did -r eduardoirc_agents 10 }
  if ($did == 61) { var %skill = $gettok($did(eduardoirc_agents,60).seltext,1,58) | var %skills = $did(eduardoirc_agents,29).text | if (!%skill) { echo -a Select a skill first. | return } | did -ra eduardoirc_agents 29 $addtok(%skills,%skill,44) }
  if ($did == 62) { did -r eduardoirc_agents 29 }
}

menu status {
  EduardoIRC
  .Connect local:/eduardoirc
  .Connect LAN:/eduardoirc-lan
  .Connect public:/eduardoirc-public
  .Start bot:/startbot
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
  ..Agents modal:/agents
  ..Agents list:/orc-agents
  ..Skills modal:/skills
  ..Skill list:/orc-skills-command
  ..Skill help:/orc-skill-help
  ..Status:/orc-status
  ..Tasks:/orc-tasks
  ..New task:/orc-new test task
}
