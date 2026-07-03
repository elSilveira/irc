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
- Tests: `node --test`, **120 passing / 0 failing** (77 legacy JS + 43 TypeScript)
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
| Orchestrator | `orchestrator` | Global service. Sees all channels and calls tools through the active brain. |
| BotService | `BotService` | Services facade: help, task creation. Legacy. |
| codex-agent | `codex-agent` | Legacy direct Codex app-server chat bridge. |

The orchestrator owns the ToolGateway. LangChain uses native LangChain tools;
Codex-backed orchestrator and spawned agents use `IRC_TOOL` lines against the
same gateway.

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
(create/list), and `conversations` (save/find thread).

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
- Agent management tool (create/list/update) usable by the orchestrator
- Spawned agents receive the shared Codex tool protocol in their role prompt
- Permission-gated, logged tool execution
- IRC routing for commands, mentions, and DMs
- Legacy control-plane features retained

## Not Implemented Yet

- Approval workflow (`approvals` table exists, no handler yet)
- Write/execute tool classes (blocked by policy by design)
- `irc_messages` and `artifacts` table persistence in code
- Real worker queue with durable task execution
- Full Kanban state machine and `@orc assign/review/summarize/logs` wiring

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

Wire the approval handler, persist IRC messages/artifacts, and implement the
remaining Kanban commands against the new orchestrator roadmap.
