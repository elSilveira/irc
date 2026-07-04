# EduardoIRC Project Status

Snapshot of the EduardoIRC control plane. Reflects the TypeScript/pnpm migration
and the new tool-capable orchestrator, alongside the original CommonJS control
plane.

## Overview

Dockerized Ergo IRCd plus a local IRC-based multi-agent control plane. Public
client access is TLS-only at `irc.eduardosilveira.dev:6697`; Docker publishes
plaintext `6667` on host loopback only for local development.

- IRCd: Ergo (`ghcr.io/ergochat/ergo:stable`) via `compose.yaml`
- Certbot Compose profile for Let's Encrypt certificates
- Legacy control plane: Node.js (CommonJS) under `packages/orchestrator`
- New control plane: TypeScript pnpm monorepo (`packages/{shared,db,llm,tools}` + `apps/orchestrator`)
- Persistence: SQLite (`data/orchestrator.sqlite`) plus Ergo state in `data/ergo/`
- Tests: `node --test`, **203 passing / 0 failing** (84 legacy JS + 119 TypeScript)
- `docker compose config` parses cleanly

## Repository Layout

```text
compose.yaml                  Docker services (ergo + certbot profile)
config/ergo/                  Ergo ircd.yaml and MOTD
scripts/                      PowerShell ops scripts (backup, restore, dev-cert, start)
clients/mirc/                 mIRC connection and @orc/@codex shortcuts
db/schema.sql                 Control-plane SQLite schema (8 tables)

packages/orchestrator/        Legacy CommonJS control plane
packages/shared/              TS: types, task ids, constants, permission policy
packages/db/                  TS: SQLite repositories
packages/llm/                 TS: provider-agnostic runtime + fallback chain
packages/tools/               TS: ToolGateway + read-only FS/git + agents
apps/orchestrator/            TS: global orchestrator service
docs/superpowers/             Plans and design notes
```

## Roles

| Role | Nick | Responsibility |
| --- | --- | --- |
| Orchestrator | `orchestrator` | Global service. Sees all channels and calls tools through the active brain. Owns task flow and agent runtime; the supervisor reconciles running agents with the `agents` table. |
| BotService | `BotService` | Agent CRUD/help facade (legacy): `HELP`, `AGENTS`, `SHOW`, `CREATE`, `UPDATE`, `DELETE`, `NEW`. Writes the shared `agents` table. |
| codex-agent | `codex-agent` | Legacy direct Codex app-server chat bridge. Not a managed agent (no `agents` row, never spawned/stopped by the supervisor). |

The orchestrator owns the ToolGateway. LangChain uses native LangChain tools;
Codex-backed orchestrator and spawned agents use `IRC_TOOL` lines against the
same gateway.

## App And Package Split

`packages/orchestrator` is the Legacy CommonJS control plane. It keeps
compatibility bots (`codex-agent`, the legacy chat bridge; and `BotService`, the
agent CRUD/help facade), mIRC tests, legacy commands, and the Codex app-server
client consumed by the new bridge.

`apps/orchestrator` is the TypeScript global orchestrator. It owns IRC routing,
the ToolGateway, active brain selection, spawned agents, chain-aware agent
conversation context, and agent lifecycle reconciliation through the supervisor.

New orchestration behavior belongs in `apps/orchestrator`; reusable primitives
belong in `packages/shared`, `packages/db`, `packages/llm`, or `packages/tools`.
See `docs/architecture.md` before moving code between these areas.

## New TypeScript Packages

### `@irc/shared`

Types (`TaskStatus`, `AgentRole`, `Agent`, `Task`, `ProviderName`), task id
helpers, channel constants, and the v1 permission policy. The policy allows
read/coordination tool capabilities (`list_files`, `read_file`, `git_status`,
`git_diff`, `manage_agents`) while blocking shell, write, deploy, and secrets
classes.

### `@irc/db`

`node:sqlite` (`DatabaseSync`) repositories bootstrapped from `db/schema.sql`:
`createRepositories`, `agents` (create/find/list/update), `tasks`
(create/list), `task_events`, `irc_messages`, approvals, and `conversations`
(save/find thread).

### `@irc/llm`

Provider-agnostic `AgentRuntime` with an ordered fallback chain. Providers:
`openai` (`@langchain/openai`), `ollama` (`@langchain/community`), and `codex`
(bridges the legacy `codex app-server` client). On quota/rate-limit/auth errors
the runtime marks the provider limited, emits a `ProviderSwitchEvent`, and tries
the next provider. `getToolCapableModel()` returns the first configured
tool-calling model for the orchestrator agent.

### `@irc/tools`

`ToolGateway` with permission-gated, logged execution. Tools: `list_files`,
`read_file` (workspace-rooted, traversal-safe, size-capped), `git_status`,
`git_diff` (allowlisted, shell-less `execFile`), and `manage_agents`
(create/list/update; fulfills the "BotService edits agents globally" goal).
`toLangChainTools()` exposes them as `DynamicStructuredTool`s, while Codex
brains call the same gateway through `IRC_TOOL` lines.

### `apps/orchestrator` (`@irc/orchestrator`)

The new global service. Connects to IRC (raw `net`), joins `#control`,
`#agents`, `#logs`, and task channels, and routes:

- `@orc help|agents|status|tasks|new` - deterministic commands
- `@orc <anything>` / `@orchestrator <text>` / DM - active brain bound to the shared ToolGateway
- Spawned agent mentions and DMs - CodexBrain with the same tool protocol

## Configuration

New env vars (see `.env.example`):

```env
ORCHESTRATOR_NICK=orchestrator
ORCHESTRATOR_CHANNELS=#control,#agents,#logs
ORCHESTRATOR_PROVIDERS=openai,ollama,codex
ORCHESTRATOR_USE_CODEX=1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1
```

## Implemented Features

- TypeScript pnpm monorepo with five workspace packages
- Provider-agnostic LLM runtime with fallback + switch callback
- LangChain tool-calling orchestrator over IRC
- Codex-backed tool loop for read-only repo tools and agent management
- Read-only workspace tools (list/read files, git status/diff)
- Scoped implementation tools (`write_file`, `run_verification`) for IRC agents
- Agent management tool (create/list/update) usable by the orchestrator
- Spawned agents receive the shared Codex tool protocol in their role prompt
- Agent replies carry `[chain:<id>]` markers for channel/DM continuity
- Agent lifecycle reconciliation: the supervisor starts new agents and stops
  deleted ones to match the shared `agents` table after every brain turn and on
  startup
- Task lifecycle protocol: agents emit structured `[task:ID] [type:ack|wip|...]`
  lines; the orchestrator ingests them into the `task_events` log, reflects
  status on the task row, persists the raw IRC line in `irc_messages`, and
  `@orc logs <TASK>` shows the timeline
- Heartbeat monitor: a periodic check flags `doing` tasks whose last `wip`
  event is stale and alerts `#logs`
- Approval workflow: a `blocked` event opens a pending approval;
  `@orc approvals` lists them and `@orc approve|deny <TASK>` resolves them
- Kanban wiring: `@orc assign <TASK> <agent>` (records `assigned_to`, DMs the
  agent), `@orc review <TASK>`, and `@orc summarize <TASK>` overview
- Permission-gated, logged tool execution
- IRC routing for commands, mentions, and DMs
- Legacy control-plane features retained

## Not Implemented Yet

- Write/execute tool classes (blocked by policy by design)
- Artifact table persistence in code
- Real worker queue with durable task execution

## Validation

```powershell
corepack pnpm install
npm run typecheck
npm run test:ts
npm test
docker compose config --quiet
```

Run the orchestrator with an LLM provider configured and IRC reachable:

```powershell
npm run orchestrator:dev
```

## Next Likely Work

Persist artifacts and implement the durable worker queue against the new
orchestrator roadmap.
