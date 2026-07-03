# IRC Agent Kanban Control Plane Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans for
> task execution. Keep implementation slices TDD-first and under 200 lines per
> hand-maintained file.

**Goal:** Build an IRC-native multi-agent control plane where BotService is the
human command facade, Orchestrator coordinates agents and tools, and task
channels preserve focused context.

**Architecture:** Ergo IRC is the interaction layer. A TypeScript orchestrator
joins global channels, routes commands/chats, owns the ToolGateway, persists
state in SQLite, and spawns created agents as IRC nicks. Codex-backed and
LangChain-backed brains must use the same tool gateway contract.

**Tech Stack:** Ergo IRC, Node.js, TypeScript, node:test, node:sqlite, LangChain,
Codex app-server, mIRC helper scripts.

---

## Current Baseline

- Legacy CommonJS bridge remains live: `codex-agent` and `BotService`.
- TypeScript workspace adds `@irc/shared`, `@irc/db`, `@irc/llm`,
  `@irc/tools`, and `@irc/orchestrator`.
- `ToolGateway` provides read-only workspace tools and agent management.
- `Orchestrator` can route deterministic `@orc` commands and chat requests.
- Created agents can be persisted and spawned as IRC nicks.

## Milestone 1: Clean Baseline

- [ ] Keep `npm test`, `npm run test:ts`, and `npm run typecheck` green.
- [ ] Keep hand-maintained source/docs under 200 lines.
- [ ] Keep generated lockfiles as the only size exception.
- [ ] Update `STATUS.md` whenever test counts or runtime roles change.
- [ ] Commit the TypeScript workspace only after verification is green.

## Milestone 2: Unified Tool Access

- [ ] Codex-backed Orchestrator can call `list_files`, `read_file`,
  `git_status`, `git_diff`, and `manage_agents`.
- [ ] LangChain-backed Orchestrator uses the same `ToolGateway`.
- [ ] Spawned agents use a brain abstraction, not raw `codex.generate()`.
- [ ] Tool calls stay permission-gated and logged.
- [ ] Write tests before each tool-routing change.

## Milestone 3: BotService Agent Facade

- [ ] `HELP` shows commands and examples.
- [ ] `AGENTS` lists persisted/running agents.
- [ ] `CREATE <id> --nick <nick> --role <role> --context <text>` creates an
  agent through the shared agent repository/tool path.
- [ ] `UPDATE <id> --role <role> --context <text>` updates agent operating
  notes.
- [ ] Creation should spawn the agent and announce it in `#agents`.

## Milestone 4: Orchestrator Global Agent

- [ ] Start `orchestrator` from the TypeScript app.
- [ ] Join `#control`, `#agents`, `#logs`, and relevant task channels.
- [ ] Route `@orchestrator <request>`, DMs, and unknown `@orc` subcommands to
  the brain.
- [ ] Deterministic commands stay fast and testable.
- [ ] Created agents should get one persisted context per channel/DM.

## Milestone 5: Task Workflow

- [ ] `@orc new "title"` creates task row and `#task-0001`.
- [ ] `@orc tasks` lists task state.
- [ ] `@orc assign TASK-0001 agent-id` invites/spawns the agent into the task
  channel.
- [ ] Task channel conversation is isolated from global control context.
- [ ] Summaries and logs should read persisted task events once implemented.

## Milestone 6: Approval-Gated Execution

- [ ] Keep shell, write, git-write, browser, deploy, and secrets blocked.
- [ ] Add approval records before enabling any execution-class tool.
- [ ] Proposed execution must produce a request id and wait for human approval.
- [ ] Denied requests must be logged and never run.

## Verification Gates

- [ ] `npm test`
- [ ] `npm run test:ts`
- [ ] `npm run typecheck`
- [ ] `docker compose config --quiet`
- [ ] hand-maintained file-size check excluding generated lockfiles

## Operating Commands

```irc
/msg BotService HELP
/msg BotService AGENTS
@orchestrator read README.md
@orc new "Build auth page"
@orc agents
```
