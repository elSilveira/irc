# EduardoIRC Project Overview

EduardoIRC combines an IRC server, mIRC client helpers, and an IRC-native
multi-agent control plane. The goal is to let a human create, route, monitor,
validate, and continue software tasks from IRC channels.

## Main Idea

IRC is the user interface. A user creates work with `@orc new ...` or
BotService commands. The orchestrator creates a task row, joins a dedicated
channel such as `#task-0001`, chooses the best available managed agent, and
asks that agent to work in the task channel. Every task message is structured
so the database can preserve state and continuity.

## Runtime Pieces

- Ergo IRCd runs in Docker and provides the IRC network.
- mIRC loads `clients/mirc/eduardoirc.mrc` for shortcuts and modal helpers.
- `helper` is the legacy Codex chat bridge for user assistance.
- `BotService` is the IRC command facade for help, tasks, agents, and skills.
- `orchestrator` is the TypeScript process that owns task flow.
- Managed agents are IRC bots created from rows in the SQLite `agents` table.

## Package Layout

- `apps/orchestrator`: runnable TypeScript orchestrator and managed agents.
- `packages/orchestrator`: legacy CommonJS helper, BotService, and mIRC tests.
- `packages/db`: SQLite schema and repositories.
- `packages/shared`: task ids, task events, permissions, and skill packs.
- `packages/tools`: allowlisted file, git, verification, and agent tools.
- `packages/llm`: provider runtime for Codex, OpenAI, and Ollama.
- `clients/mirc`: mIRC script and user docs.

## Data Model

SQLite stores:

- `agents`: identity, nick, role, context, strengths, weaknesses, capacity,
  skills, and status.
- `tasks`: title, status, split channel, assigned agent, and timestamps.
- `task_events`: structured task protocol messages.
- `irc_messages`: raw IRC messages linked to tasks when available.
- `approvals`: pending blocked-task approvals.
- `artifacts`: schema placeholder for future durable outputs.
- `codex_conversations`: persisted Codex thread ids per channel, DM, or task.

## Task Lifecycle

A normal implementation task follows this path:

1. User sends `@orc new <title>`.
2. Orchestrator creates `TASK-0001` and `#task-0001`.
3. Agent routing scores registered non-QA agents by strengths and weaknesses.
4. The selected agent joins the task channel and emits `ack` plus `wip`.
5. While Codex is working, the agent emits `wip still working` heartbeats.
6. The agent reports `result` and `rdt`.
7. Orchestrator assigns QA.
8. QA emits `testing`, `tested`, then exactly one `pass` or `not.pass`.
9. `pass` marks the task done.
10. `not.pass` returns the task to the implementer with concrete feedback.

If a doing task becomes stale, heartbeat recovery records `heartbeat.resume`
and reassigns it to the current agent with a resume prompt.

## Tools And Safety

Agents do not receive arbitrary shell access. They use ToolGateway tools:

- `list_files`
- `read_file`
- `write_file`
- `git_status`
- `git_diff`
- `run_verification`
- `manage_agents`

Writes are constrained to the workspace and reject hand-maintained files over
200 lines. Verification commands are allowlisted: `npm test`,
`npm run test:ts`, `npm run typecheck`, and `docker compose config --quiet`.

## IRC Commands

Common orchestrator commands:

- `@orc help`
- `@orc agents`
- `@orc tasks`
- `@orc new "Task title"`
- `@orc assign TASK-0001 agent-id`
- `@orc summarize TASK-0001`
- `@orc logs TASK-0001`
- `@orc approve TASK-0001`
- `@orc deny TASK-0001`

Common BotService commands:

- `/msg BotService HELP`
- `/msg BotService HELP AGENTS`
- `/msg BotService CREATE <id> --nick <nick> --role <role> --context "text"`
- `/msg BotService UPDATE <id> --strengths docs,tests --capacity 2`
- `/msg BotService DELETE <id>`
- `/msg BotService NEW "Task title"`

## mIRC Capabilities

The mIRC script provides aliases for connecting, identifying registered nicks,
Codex helper access, BotService shortcuts, orchestrator task commands, and a
skills modal. The skills modal lets the user choose or edit a skill, add detail,
and create a task from the selected context.

## Current Capabilities

- Create tasks from IRC and split each task into its own channel.
- Persist task event history and raw IRC task messages.
- Create, update, delete, list, and route agents.
- Start/stop managed agent IRC bots from DB reconciliation.
- Preserve Codex conversation context per channel, DM, and task.
- Let agents edit files and run verification through scoped tools.
- Keep long tasks visible with heartbeats.
- Recover stale tasks by reassigning them.
- Run QA automatically after implementation is ready to test.

## Current Limits

- Queued tasks need a durable scheduler.
- Artifact storage is not productized.
- Skills need full CRUD and richer pack composition.
- Status reporting is functional but still terse.
- Some legacy CommonJS code remains until compatibility is migrated.
