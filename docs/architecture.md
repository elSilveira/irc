# Architecture Notes

This repo is in a migration phase. Two orchestrator directories exist on
purpose, but they have different responsibilities.

## Directory Split

`packages/orchestrator` is the Legacy CommonJS control plane. It contains the
stable IRC bots and compatibility code that existed before the TypeScript app:

- `helper`, the direct Codex app-server IRC bridge (user assistance
  only; it is not a managed agent)
- `BotService`, the agent CRUD and help facade (`HELP`, `AGENTS`, `SHOW`,
  `CREATE`, `UPDATE`, `DELETE`, `NEW`). It edits the shared `agents` table that
  the orchestrator consumes.
- mIRC shortcut tests and legacy command parsing
- the CommonJS Codex app-server transport used by the TypeScript bridge

`apps/orchestrator` is the TypeScript global orchestrator. It is the runnable
service for the new multi-agent control plane:

- connects as `orchestrator`
- owns the shared ToolGateway
- routes `@orc`, `@orchestrator`, DMs, and spawned agent traffic
- owns agent lifecycle via the supervisor, reconciling running agents with the
  `agents` table (starts new agents, stops deleted ones) on startup and after
  every brain turn
- spawns persistent agents such as `feature-implementer`
- adds `[chain:<id>]` continuity markers for agent conversations

Shared TypeScript code lives under `packages/shared`, `packages/db`,
`packages/llm`, and `packages/tools`.

## Ownership Rules

- Put new global orchestration behavior in `apps/orchestrator`.
- Put reusable TypeScript primitives in the smallest matching package.
- Keep legacy CommonJS changes in `packages/orchestrator` only when they support
  existing bots, mIRC compatibility, or the Codex app-server bridge.
- Do not add new feature ownership to the legacy package unless it is required
  for backward compatibility.
- Keep hand-maintained files under 200 lines; split by responsibility first.

## Control Surface Split

- BotService owns the agent admin commands: `HELP`, `AGENTS`, `SHOW`,
  `CREATE`, `UPDATE`, `DELETE`, and `NEW`. It writes to the shared `agents`
  table.
- The orchestrator owns task flow, agent runtime, and tool routing. Its
  supervisor reconciles running IRC agents with the `agents` table, so
  BotService edits (creates or deletes) take effect live without a restart.
- The shared `agents` table is the hand-off contract between the two: BotService
  is the writer of record, the supervisor is the consumer.
- `helper` is a legacy direct chat bridge, not a managed agent; it has no
  row in the `agents` table and is never spawned or stopped by the supervisor.
- Structured task lines (`[task:...]`) are ingested by the orchestrator, written
  to `task_events`, reflected onto the task row, and persisted raw in
  `irc_messages` for durable conversation context.

## Runtime Map

```text
Ergo IRCd
  -> helper (packages/orchestrator, legacy direct bridge)
  -> BotService (packages/orchestrator, agent CRUD/help facade) --writes--> agents table
  -> orchestrator (apps/orchestrator, TypeScript global orchestrator)
       -> supervisor --reconciles--> agents table (start new / stop deleted)
       -> spawned agents (apps/orchestrator AgentBot)
       -> ToolGateway (packages/tools)
       -> SQLite repositories (packages/db)
       -> LLM/Codex bridge (packages/llm + legacy codex app client)
```

## Migration Target

The target shape is:

- `apps/orchestrator`: runnable process and IRC lifecycle
- `packages/*`: reusable libraries only
- legacy bots either migrated into the TypeScript app or moved under a clearly
  named legacy app once compatibility is no longer needed
