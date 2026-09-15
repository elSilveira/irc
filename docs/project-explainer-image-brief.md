# EduardoIRC Image Brief

Use this brief to create a clearer, more polished project explainer image for
EduardoIRC.

## Goal

Create a technical infographic that explains EduardoIRC as an IRC-native
multi-agent control plane. The image should make the project understandable at a
glance for someone reading the repository, README, or project documentation.

## Recommended Format

- Landscape infographic, 16:11 or 16:9.
- Minimum size: 1600 x 1100.
- Output formats: SVG for editable text, PNG for sharing.
- Style: clean technical diagram, readable labels, restrained colors, no
  decorative clutter.

## Main Headline

EduardoIRC

## Subtitle

IRC-native multi-agent control plane for creating, routing, monitoring, and
validating software work.

## Core Story

IRC is the user interface. A human creates a task from IRC with `@orc new` or
mIRC shortcuts. The TypeScript orchestrator creates a tracked task, opens a
dedicated task channel, chooses a managed agent, routes work through safe tools,
persists task history in SQLite, and sends the result through QA before marking
the task done.

## Required Sections

### 1. IRC Surface

Show these elements flowing left to right:

- Human operator
- mIRC shortcuts
- Ergo IRCd
- Command channels: `#control`, `#agents`, `#logs`
- Split task channels such as `#task-0001`

Key message: humans use IRC channels, aliases, DMs, and commands as the control
surface.

### 2. Orchestration Runtime

Show the runtime as the center of the image:

- Legacy control plane: `helper` and `BotService`
- TypeScript orchestrator: `apps/orchestrator`
- Supervisor
- Managed agents: implementer, researcher, QA

Key message: legacy compatibility bots remain, while the TypeScript
orchestrator owns task flow, agent runtime, and routing.

### 3. Shared Data, Tools, And Brains

Show these as supporting infrastructure below the runtime:

- SQLite repositories: agents, tasks, task events, IRC messages, approvals
- ToolGateway: file, git, verification, and agent tools
- LLM provider runtime: Codex, OpenAI, Ollama fallback chain
- Shared packages: ids, permissions, task protocol, types

Key message: agents do not get arbitrary shell access. They work through scoped
tools and persisted context.

### 4. Task Lifecycle

Show this as a numbered horizontal flow along the bottom:

1. Create: `@orc new`
2. Split: `#task-0001`
3. Route: best available agent
4. Work: `ack`, `wip`, `htb`
5. Result: `result`, `rdt`
6. QA: test feedback
7. Finish: `pass` or loop on `not.pass`

## Exact Labels To Include

- EduardoIRC
- Human operator
- mIRC shortcuts
- Ergo IRCd
- Command channels
- Legacy control plane
- BotService
- TypeScript orchestrator
- Supervisor
- Managed agents
- SQLite repositories
- ToolGateway
- LLM provider runtime
- Task Lifecycle
- Current gaps: durable queue, artifact persistence, richer skill CRUD

## Visual Direction

Use a three-band layout:

1. Top band: IRC surface.
2. Middle band: orchestration runtime.
3. Lower band: data, tools, and LLM providers.
4. Bottom strip: task lifecycle.

Use arrows to show flow. Make the TypeScript orchestrator the visual anchor.
Use muted, professional colors with a few accents:

- Deep blue or charcoal for the header.
- Teal or green accents for successful task flow.
- Warm amber badge for legacy components.
- Soft red or rose badge for current gaps.
- White cards on a light neutral background.

## Copy-Ready Image Prompt

Create a polished technical infographic titled "EduardoIRC".

The subject is an IRC-native multi-agent control plane. Make a clean landscape
architecture diagram with readable labels, clear arrows, and a professional
software-engineering visual style.

Structure the image in four horizontal areas:

1. IRC Surface: Human operator -> mIRC shortcuts -> Ergo IRCd -> command
   channels `#control`, `#agents`, `#logs`, plus split task channels like
   `#task-0001`.
2. Orchestration Runtime: legacy control plane with `helper` and `BotService`,
   TypeScript orchestrator in `apps/orchestrator`, Supervisor, and Managed
   agents for implementer, researcher, and QA roles.
3. Shared Data, Tools, And Brains: SQLite repositories, ToolGateway, LLM
   provider runtime with Codex, OpenAI, and Ollama, and shared packages for ids,
   permissions, task protocol, and types.
4. Task Lifecycle: a numbered flow: Create `@orc new`, Split `#task-0001`,
   Route best agent, Work `ack/wip/htb`, Result `result/rdt`, QA test feedback,
   Finish `pass` or loop on `not.pass`.

Use a crisp flat-vector style, white cards, subtle shadows, thin arrows, a deep
blue header, teal flow accents, amber legacy badges, and a small soft-red
"Current gaps" badge for durable queue, artifact persistence, and richer skill
CRUD.

All text must be sharp, spelled exactly, and large enough to read. Avoid
decorative server-room imagery, tiny unreadable labels, random code snippets,
mascots, stock-photo style, blurry text, and excessive gradients.

## Short Prompt Variant

Create a clean SVG-style technical infographic for "EduardoIRC", an IRC-native
multi-agent control plane. Show IRC input, Ergo IRCd, legacy helper/BotService,
the TypeScript orchestrator, supervisor, managed agents, SQLite, ToolGateway,
LLM providers, shared packages, and the task lifecycle from `@orc new` to QA
`pass` or `not.pass`. Use readable labels, arrows, white cards, deep blue
header, teal flow accents, amber legacy badge, and soft red current-gaps badge.

## Negative Prompt

Avoid blurry text, misspelled labels, random icons, fantasy themes, mascots,
stock photos, dark unreadable backgrounds, dense spaghetti arrows, decorative
server racks, fake code, excessive gradients, and labels smaller than body text.

## Improvement Ideas Over The Current SVG

- Make the orchestrator larger and more central.
- Add small IRC channel bubbles to make the IRC-native idea more obvious.
- Use clearer visual separation between legacy compatibility and new
  TypeScript ownership.
- Use icons sparingly: person, terminal, server, database, shield, checkmark.
- Add a small "safe tools only" callout near ToolGateway.
- Make the lifecycle strip visually stronger, since it explains how work gets
  completed.
