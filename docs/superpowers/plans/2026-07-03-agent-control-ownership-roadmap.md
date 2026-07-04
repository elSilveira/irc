# Agent Control Ownership Roadmap

**Goal:** Make BotService the agent CRUD/help facade, keep Orchestrator as the
task-flow maestro, and clearly mark `codex-agent` as legacy compatibility.

## Current Problem

- `codex-agent` is a legacy direct Codex bridge, not the same as managed agents.
- BotService can list only a hard-coded `codex-agent` and cannot edit/delete
  managed agents.
- Orchestrator can create/spawn agents, but it should coordinate flows rather
  than own the admin command surface.
- BotService-created database changes need to be reflected by the running
  orchestrator without manual restart.

## Target Ownership

- BotService: `HELP`, `AGENTS`, `SHOW`, `CREATE`, `UPDATE`, `DELETE`.
- Orchestrator: task chains, agent flow, task progress, tool routing.
- Managed agents: spawned through `AgentBot` and the shared brain/tool gateway.
- `codex-agent`: legacy compatibility bridge only.

## Implementation Checkpoints

- [x] Roadmap created.
- [x] BotService tests cover agent list/show/create/update/delete.
- [x] Legacy agent repository supports list/update/delete.
- [x] BotService CRUD uses the shared SQLite `agents` table.
- [x] Orchestrator supervisor can reconcile database changes.
- [x] Orchestrator starts new agents and stops deleted agents after reconcile.
- [x] README/STATUS/architecture clarify ownership and `codex-agent` boundary.
- [x] Verification passes: `npm test`, `npm run test:ts`, `npm run typecheck`,
  `docker compose config --quiet`, file-size guard.

## Resume Notes

Start with `packages/orchestrator/test/botserv-service.test.js` and
`packages/orchestrator/src/botserv-service.js`. Keep legacy changes focused on
BotService compatibility. Put orchestration lifecycle changes in
`apps/orchestrator/src/supervisor.ts` and tests beside it.
