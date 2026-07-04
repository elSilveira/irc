# Task Lifecycle Protocol Roadmap

**Goal:** Give agents a structured, durable task-event protocol over IRC so the
orchestrator can track ACK/WIP/RESULT/DONE, capture context and review
hand-offs, and block on approvals — replacing free-text status chatter.

Source spec: `docs/nexts.txt`.

## Current State

- The `[task:ID] [type:...]` protocol is parsed/formatted in `@irc/shared` and
  agents are prompted to emit ACK/WIP/RESULT/DONE lines.
- The orchestrator ingests those lines into the `task_events` log, reflects a
  derived status on the `tasks` row, and surfaces timelines via `@orc logs`.
- `@orc assign`/`review`/`summarize` and the approval flow
  (`@orc approvals`, `@orc approve|deny`) are wired; `blocked` events open
  pending approvals.
- A heartbeat monitor flags stale `doing` tasks.
- Structured task lines are now persisted in `irc_messages`; `artifacts` still
  has no writer/reader, so artifact durability remains the next storage gap.

## Target Protocol

IRC lines from agents follow:

```text
[task:TASK-0001] [from:feature-implementer] [type:ack] [status:working]
optional human-readable body
```

Event types: `ack`, `wip`, `context.request`, `context.result`,
`review.request`, `review.result`, `blocked`, `result`, `done`, `failed`.

Agent rules (from `nexts.txt`): on a received task, send `ack` immediately, `wip`
every 20–30s while working, `blocked` with a reason when stuck, `result` then
`done` on completion.

## Implementation Checkpoints

- [x] Roadmap created.
- [x] Task-event protocol parser/formatter + types in `@irc/shared`.
- [x] `TaskEventRepository` writes/reads the `task_events` table (`@irc/db`).
- [x] `tasks.updateStatus` / `findTask` on the task repository.
- [x] Orchestrator ingests agent `[task:...]` lines into the event log and
  reflects status on the task row.
- [x] `@orc logs <TASK>` command surfaces the event timeline.
- [x] Agent role prompts instruct the ACK/WIP/RESULT/DONE protocol.
- [x] Heartbeat/timeout monitor flags stale `wip` tasks.
- [x] Approval handler resolves `blocked`/`waiting_permission` tasks.
- [x] Kanban wiring: `@orc assign`/`review`/`summarize` with `assigned_to` tracking.
- [x] `irc_messages` persistence for structured agent lines.
- [x] Verification passes: `npm test`, `npm run test:ts`, `npm run typecheck`,
  `docker compose config --quiet`, file-size guard.

## Resume Notes

Start with the pure parser in `packages/shared/src/task-events.ts` (fully
testable, no DB). Then the repository in `packages/db/src/task-events.ts` against
the existing `task_events` table. Orchestrator ingestion belongs in
`apps/orchestrator/src` (router/handler), and the `@orc logs` command extends
`apps/orchestrator/src/commands.ts`. Keep heartbeat monitoring and the approval
handler for later slices.
