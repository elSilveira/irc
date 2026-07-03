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

alias codex-status {
  msg #control @codex status
}

alias codex-help {
  msg #control @codex help
}

alias codex-login {
  msg #control @codex login
}

alias codex-echo {
  if (!$1) { echo -a Usage: /codex-echo <text> | return }
  msg #control @codex echo $1-
}

alias botserv-help {
  msg BotService HELP
}

alias botserv-new {
  if (!$1) { echo -a Usage: /botserv-new <task title> | return }
  msg BotService NEW $qt($1-)
}

alias orc-agents {
  msg #control @orc agents
}

alias orc-status {
  msg #control @orc status
}

alias orc-tasks {
  msg #control @orc tasks
}

alias orc-new {
  if (!$1) { echo -a Usage: /orc-new <task title> | return }
  msg #control @orc new $qt($1-)
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
  ..Status:/orc-status
  ..Tasks:/orc-tasks
  ..New task:/orc-new test task
}
