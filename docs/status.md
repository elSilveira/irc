# Project Status

Last updated: 2026-07-04.

## Current State

EduardoIRC is a Dockerized Ergo IRC server plus a local IRC multi-agent control
plane. The server is usable from mIRC, while the control plane runs `helper`,
`BotService`, `orchestrator`, and any managed agents created in SQLite.

Runtime was reset after the last live test. The live database is expected to
start with zero tasks, task events, approvals, IRC messages, Codex threads, and
managed agents unless a test creates them.

## Implemented

- Local IRC server through Docker Compose.
- TLS public/LAN paths and plaintext loopback mIRC path.
- `helper` Codex app-server bridge with per-channel and per-DM context.
- `BotService` command/help/admin facade.
- TypeScript `orchestrator` with task routing and managed-agent runtime.
- SQLite repositories for agents, tasks, task events, messages, approvals,
  artifacts placeholder, and Codex conversations.
- Agent CRUD with role, context, strengths, weaknesses, capacity, and skills.
- Skill-pack inference for implementation, QA, orchestration, research, and ops.
- Task channels like `#task-0001`.
- Structured task protocol with `ack`, `wip`, `blocked`, `result`, `rdt`,
  `testing`, `tested`, `pass`, and `not.pass`.
- Agent-side `wip still working` heartbeat during long Codex turns.
- Stale-task recovery through orchestrator reassignment.
- QA lifecycle: `rdt` to QA, `pass` to done, `not.pass` back to implementer.
- mIRC aliases for Codex, BotService, task commands, NickServ, and skills modal.

## Latest Log Lesson

`log.md` showed two operational mistakes:

- A task created before agents exist has nowhere to run. The system correctly
  says "No agents registered"; tests must create agents first.
- A long-running agent can emit several heartbeats and still end with blocked
  if Codex returns no task protocol output. The system now normalizes missing
  output to `blocked` and emits heartbeats while the turn is pending, but agent
  prompts still need to push toward concrete `result` plus `rdt`.

## Known Gaps

- No durable worker queue yet; queued tasks are represented in DB but not fully
  drained by a scheduler.
- Artifact persistence is defined in schema but not used as a product feature.
- Skills are static packs plus BotService guidance; full skill CRUD is not done.
- Agent context is stored, but richer memory and per-task artifact summaries are
  still roadmap work.
- Runtime reset should stop live Node processes first to avoid racing DB state.

## Verification Commands

```powershell
npm test
npm run test:ts
npm run typecheck
docker compose config --quiet
```

## Clean Runtime

```powershell
node scripts/reset-control-plane-state.js data/orchestrator.sqlite
powershell -ExecutionPolicy Bypass -File .\scripts\start-helper.ps1
npm run orchestrator:dev
```
