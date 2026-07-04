# EduardoIRC

Dockerized Ergo IRCd plus a local IRC multi-agent control plane. Public client
access is TLS-only at `irc.eduardosilveira.dev:6697`; Docker publishes local
plaintext IRC on `127.0.0.1:6667` for development and mIRC testing.

## Agent Operating Reference

Use this README as the first project context before changing code. Then inspect
the relevant source and tests named below.

Core rules:

- Keep hand-maintained source, test, and docs files under 200 lines.
- Add or update tests before behavior changes; run the targeted failing test,
  implement the smallest slice, then rerun the targeted and wider suite.
- Keep new global orchestration work in `apps/orchestrator`.
- Keep reusable TypeScript primitives in `packages/shared`, `packages/db`,
  `packages/llm`, or `packages/tools`.
- Touch `packages/orchestrator` only for legacy CommonJS bots, mIRC
  compatibility, or Codex app-server bridge compatibility.
- Do not treat `helper` as a managed agent. Managed agents live in the
  SQLite `agents` table and are started/stopped by the TypeScript supervisor.

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
docs/superpowers/plans/         Active project roadmaps
```

## Runtime Ownership

`packages/orchestrator` is the Legacy CommonJS control plane:

- `helper`: direct Codex app-server IRC bridge for user assistance.
- `BotService`: command/help/admin facade for agents and tasks.
- mIRC tests, legacy parsing, and Codex app-server transport.

`apps/orchestrator` is the TypeScript global orchestrator:

- connects as `orchestrator`;
- owns task flow, ToolGateway routing, and active LLM/Codex brain selection;
- routes `@orc`, `@orchestrator`, DMs, and managed agent traffic;
- reconciles running managed agents with the shared `agents` table.

BotService writes agent CRUD changes to SQLite. The orchestrator supervisor
consumes that table and starts new agents or stops deleted agents after startup
and after brain turns.

## Local Start

```powershell
Copy-Item .env.example .env
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\scripts\start-helper.ps1
npm run orchestrator:dev
```

For a clean live test state:

```powershell
node scripts/reset-control-plane-state.js data/orchestrator.sqlite
```

The reset script clears `agents`, tasks, task events, IRC messages, approvals,
artifacts, and Codex conversation threads. Stop running control-plane Node
processes first when you need a strict zero-state restart.

## mIRC Quick Test

Load the helper:

```text
/load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
/eduardoirc
/join #control
```

Useful aliases:

```text
/codex-login
/codex-status
/botserv-help
/botserv-new Build local IRC control plane
/orc-agents
/orc-status
/orc-tasks
/orc-new Build local IRC control plane
/orc-agent-create researcher-agent researcher researcher Finds missing context
/orc-assign TASK-0001 researcher-agent
/orc-summarize TASK-0001
/orc-logs TASK-0001
```

Raw commands for a zero-state agent test:

```text
/msg BotService HELP
/msg BotService AGENTS
/msg BotService CREATE feature-implementer --nick FeatureImpl --role implementer --context "IRC feature work" --strengths irc,typescript,tests --weaknesses design --capacity 1
/msg BotService AGENTS
@orchestrator agents
@orchestrator please create a task to verify agent creation from zero
```

`/codex-login` asks the local `codex app-server` for a ChatGPT OAuth URL. After
login, use `@codex <message>` in a channel. Direct messages to `helper`
also work without `@codex`. Each channel and DM has its own persisted Codex
thread, and `@orc new "Title"` creates a split channel like `#task-0001`.

BotService commands:

```text
/msg BotService HELP
/msg BotService HELP AGENTS
/msg BotService HELP TASKS
/msg BotService HELP SKILLS
/msg BotService HELP CODEX
/msg BotService AGENTS
/msg BotService SHOW <id>
/msg BotService CREATE <id> --nick <nick> --role <role> --context "text"
/msg BotService UPDATE <id> --role <role> --context <text>
/msg BotService UPDATE <id> --strengths docs,tests --weaknesses infra --capacity 2
/msg BotService DELETE <id>
/msg BotService NEW "Task title"
```

## Task Protocol

Agents should correlate work with chain and task markers.

Conversation continuity:

```text
[chain:<id>] answer or follow-up
```

Task lifecycle lines:

```text
[task:TASK-0001] [type:ack] acknowledged, starting
[task:TASK-0001] [type:wip] current step: reading README
[task:TASK-0001] [type:htb] still working
[task:TASK-0001] [type:blocked] need approval to continue
[task:TASK-0001] [type:result] implemented and verified
[task:TASK-0001] [type:rdt] ready for QA
[task:TASK-0001] [type:pass] QA accepted the result
```

The orchestrator writes structured task lines to `task_events`, persists the raw
IRC line in `irc_messages`, reflects task status on `tasks`, opens approvals for
`blocked`, hands `rdt` to QA, loops `not.pass` back to the implementer, and
exposes history through `@orc logs <TASK-0001>`.

## Implemented Status

- Ergo IRCd via Docker Compose.
- Legacy `helper` and BotService compatibility bots.
- TypeScript global orchestrator with ToolGateway-backed managed agents.
- BotService agent CRUD: `HELP`, `AGENTS`, `SHOW`, `CREATE`, `UPDATE`,
  `DELETE`, plus `NEW <title>`.
- Managed agent lifecycle reconciliation from the SQLite `agents` table.
- Agent routing metadata: `strengths`, `weaknesses`, and `capacity`.
- `@orc new` routes tasks to the best free agent or queues for the best busy
  agent.
- Scoped tools: list/read/write workspace files, git status/diff,
  verification, and agent management.
- Durable SQLite state for agents, tasks, task events, IRC messages, approvals,
  and Codex conversation threads.
- Task channels, task lifecycle protocol, heartbeat checks, approvals, and
  Kanban commands: `assign`, `review`, `summarize`, `logs`.
- Agent-side `wip still working` heartbeats while long Codex turns run.
- Stale-task recovery that reassigns active work to the current agent.
- QA lifecycle: implementation `rdt` triggers QA, QA `pass` closes the task,
  and QA `not.pass` sends concrete feedback back to the implementer.
- mIRC `/orc-skills` modal with editable skill and detail fields for task
  creation.

Not implemented yet:

- Artifact persistence beyond the current schema placeholder.
- Durable worker queue.
- Rich skill-pack CRUD beyond current BotService guidance and static packs.

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

For production TLS, set `IRC_DOMAIN`, `ACME_EMAIL`, and DNS, then run Certbot:

```powershell
docker compose --profile certbot run --rm --service-ports certbot certonly --standalone -d irc.eduardosilveira.dev -m your-real-email@example.com --agree-tos --no-eff-email
```

## References

- Ergo Docker docs: https://github.com/ergochat/ergo/blob/master/distrib/docker/README.md
- Ergo manual: https://github.com/ergochat/ergo/blob/master/docs/MANUAL.md
- Ergo default config: https://github.com/ergochat/ergo/blob/stable/default.yaml
