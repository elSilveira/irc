# EduardoIRC

Dockerized Ergo IRCd plus a local IRC multi-agent control plane. Public client
access is TLS-only at `irc.eduardosilveira.dev:6697`; Docker publishes local
plaintext IRC on `127.0.0.1:6667` for development and mIRC testing.

## Agent Operating Reference

Use this README as first project context before changing code, then inspect the
relevant source and tests.

Core rules:

- Keep hand-maintained source, test, and docs files under 200 lines.
- Add or update tests before behavior changes when code behavior changes.
- Keep new global orchestration work in `apps/orchestrator`.
- Keep reusable TypeScript primitives in `packages/shared`, `packages/db`,
  `packages/llm`, or `packages/tools`.
- Touch `packages/orchestrator` only for legacy CommonJS bots, mIRC
  compatibility, or Codex app-server bridge compatibility.
- Do not treat `helper` as a managed agent. Managed agents live in SQLite and
  are started/stopped by the TypeScript supervisor.

Fast context map:

```text
apps/orchestrator/              TypeScript global orchestrator and AgentBot
packages/orchestrator/          Legacy CommonJS helper and BotService
packages/shared/                Shared ids, permissions, task-event protocol
packages/db/                    SQLite repositories over db/schema.sql
packages/tools/                 ToolGateway and allowlisted agent tools
packages/llm/                   Provider runtime and Codex bridge
clients/mirc/                   mIRC aliases and operator usage
docs/architecture.md            Ownership rules and migration target
docs/status.md                  Current status and known gaps
docs/project-overview.md        Plain-language project explanation
docs/project-explainer.svg      Visual architecture explainer
```

## Runtime Ownership

`packages/orchestrator` is the legacy CommonJS control plane: `helper`,
BotService, mIRC tests, legacy parsing, and Codex app-server transport.

`apps/orchestrator` is the TypeScript global orchestrator. It connects as
`orchestrator`, owns task flow and ToolGateway routing, routes `@orc`, DMs, and
managed agent traffic, and reconciles running managed agents with SQLite.

BotService writes agent CRUD, model metadata, and task requests to SQLite. The
orchestrator supervisor starts new agents or stops deleted agents after startup
and after brain turns.

## Local Start

```powershell
Copy-Item .env.example .env
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\scripts\start-helper.ps1
npm run orchestrator:dev
```

From mIRC, `/startbot` runs `scripts\restart-service.ps1`, restarting Docker,
helper, BotService, and orchestrator. When the orchestrator comes back up, it
rejoins configured, project, and task channels and reconciles managed agents
from SQLite.

For a clean live test state, run
`node scripts/reset-control-plane-state.js data/orchestrator.sqlite`. The reset
script clears agents, tasks, task events, IRC messages, approvals, artifacts,
and Codex conversation threads. Stop running control-plane Node processes first
when you need a strict zero-state restart.

## mIRC Quick Test

```text
/load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
/eduardoirc
/join #control
```

Useful aliases: `/startbot`, `/codex-login`, `/codex-status`, `/botserv-help`,
`/botserv-new Build local IRC control plane`, `/agents`, `/orc-agents`, `/orc-status`,
`/orc-tasks`, `/orc-skills`, `/orc-new Build local IRC control plane`,
`/orc-agent-create researcher-agent researcher researcher Finds missing context`,
`/orc-assign TASK-0001 researcher-agent`,
`/project connect #client-a C:\Users\duzit\source\client-a`,
`/orc-summarize TASK-0001`, and `/orc-logs TASK-0001`.

`/codex-login` asks the local `codex app-server` for a ChatGPT OAuth URL. After
login, use `@codex <message>` in a channel. Direct messages to `helper` also
work without `@codex`. Each channel and DM has its own persisted Codex thread.
Managed Codex agents use scoped `IRC_TOOL` calls for `list_files`, `read_file`,
`write_file`, and `run_verification` only when the orchestrator prompt
advertises those tools.

## Channel-Based Project Flow

Map a project channel to a workspace, bring agents into that channel, then
create work from the project channel:

```text
@orc project connect <#channel|name> <workspace>
@orc join <#channel> <agent|all>
@orc agent create|update|delete <id> --nick <nick> --role <role> --context <prompt> --channels <csv>
@orc new "Task title"
```

Use `@orc new "Title"` or `/orc-new Title` from a project channel to create a
tracked task. The orchestrator stores the project channel and workspace on the
task, opens a split task channel like `#task-0001`, assigns the best available
managed agent, and routes that agent's work through the task channel.

The broad project conversation can stay in `#control`, while each task channel
keeps separate IRC history, Codex thread, lifecycle events, approval state, QA
loop, and logs. Current task commands: `@orc tasks`, `@orc logs <TASK-0001>`,
`@orc approvals`, `@orc approve|deny <TASK-0001>`,
`@orc assign <TASK-0001> <agent>`, `@orc review <TASK-0001>`,
`@orc sign <TASK-0001>`, and `@orc summarize <TASK-0001>`.

## Task Protocol

Agents should correlate work with chain and task markers.

```text
[chain:<id>] answer or follow-up
[task:TASK-0001] [type:ack] acknowledged, starting
[task:TASK-0001] [type:wip] current step: reading README
[task:TASK-0001] [type:htb] still working
[task:TASK-0001] [type:blocked] need approval to continue
[task:TASK-0001] [type:result] implemented and verified
[task:TASK-0001] [type:rdt] ready for QA
[task:TASK-0001] [type:pass] QA accepted the result
```

The orchestrator writes task lines to `task_events`, persists raw IRC lines in
`irc_messages`, reflects task status on `tasks`, opens approvals for `blocked`,
hands `rdt` to QA, loops `not.pass` back to the implementer, and exposes history
through `@orc logs <TASK-0001>`.

Approval updates are automatic: `blocked` creates or updates approval state, and
later `wip`, `result`, `rdt`, `pass`, or `not.pass` events keep lifecycle state
synchronized without manual database edits.

## BotService Commands

```text
/msg BotService HELP
/msg BotService HELP AGENTS
/msg BotService HELP TASKS
/msg BotService HELP SKILLS
/msg BotService HELP MODELS
/msg BotService HELP OPS
/msg BotService HELP CODEX
/msg BotService AGENTS
/msg BotService SHOW <id>
/msg BotService CREATE <id> --nick <nick> --role <role> --context "text"
/msg BotService UPDATE <id> --role <role> --context <text>
/msg BotService UPDATE <id> --strengths docs,tests --weaknesses infra --capacity 2
/msg BotService UPDATE <id> --model <provider> --auth <login|api-key|local>
/msg BotService DELETE <id>
/msg BotService NEW "Task title"
```

`HELP MODELS` documents per-agent provider/auth/model fields for Codex,
OpenAI, Ollama, and Z.AI-style login or key modes. `HELP OPS` documents
`BUILD`, `RESTART`, and `DEPLOY` for local service operations.

## Implemented Status

Implemented: Dockerized Ergo, legacy `helper` and BotService bots, TypeScript
orchestrator, SQLite-backed agent/task/project state, managed agent
reconciliation, project-channel routing, split task channels, ToolGateway scoped
tools, task lifecycle protocol, approvals, task signoff, heartbeats, stale-task
recovery, QA loop, per-agent model metadata, BotService ops help, `/startbot`,
and mIRC agent/skill/task aliases including `/agents` and `/orc-skills`.

Not implemented yet: durable worker queue, productized artifact persistence,
and rich skill-pack CRUD beyond current BotService guidance and static packs.

For fuller project status and known gaps, see `docs/status.md`. For a complete
project explanation, see `docs/project-overview.md`.

## Validation

```powershell
npm test
npm run test:ts
npm run typecheck
docker compose config --quiet
```

## Operations

```powershell
docker compose logs -f ergo
docker compose kill -s HUP ergo
docker compose down
powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1 -ArchivePath .\backups\irc-server-YYYYMMDD-HHMMSS.zip
```
