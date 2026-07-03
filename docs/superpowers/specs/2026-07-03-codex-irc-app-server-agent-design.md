# Codex IRC App-Server Agent Design

## Goal

Connect the IRC `codex-agent` bot to the local Codex app-server so mIRC can
talk to a real Codex session without an OpenAI API key. Each IRC channel and
direct-message conversation must have its own durable context.

## Chosen Approach

Use the HelpAI pattern: start `codex app-server` locally and communicate with it
over newline-delimited JSON-RPC on stdio. Codex owns OAuth, token refresh, model
access, and streamed agent events. The IRC bot only sends prompts and relays
assistant text back to IRC.

This matches the Codex app-server documentation: clients initialize the
connection, start or resume threads, start turns, and read streamed
notifications such as `item/agentMessage/delta` and `turn/completed`.

## Conversation Scope

Context keys are explicit and persisted:

```text
channel:#control
channel:#task-0001
dm:esilveira
```

Channel messages are handled only when they begin with `@codex`. Direct messages
to the bot accept both `@codex text` and plain text because the user already
addressed the agent directly.

Each context key maps to one Codex thread id. Restarting the bot should reuse
the saved thread id when possible.

## Task Channels

`@orc new "title"` creates the next task id, stores the task, derives the task
channel, joins that channel, and posts a starter message. The task channel gets
its own context key and therefore its own Codex thread.

This keeps broad coordination in `#control` while implementation discussion can
move into `#task-0001`, `#task-0002`, and so on.

## Login Flow

`@codex login` checks the Codex account through app-server. If a ChatGPT account
is already available, the bot replies with a signed-in status. If not, it calls
`account/login/start` and replies with the browser auth URL or device-code
instructions returned by Codex.

The bot must not read `~/.codex/auth.json`, print tokens, or store auth secrets.

## Safety

The first slice remains chat-only:

- Codex thread sandbox is read-only.
- IRC turns use `approvalPolicy: never`.
- No shell, file editing, Git, browser, deploy, or secret access is exposed from
  IRC.
- Future tool execution must be added behind explicit admin approval commands.

## Components

- `codex-rpc-transport`: starts `codex app-server`, sends JSON-RPC requests,
  routes responses, and queues notifications.
- `codex-app-client`: initializes app-server, reads account state, starts login,
  starts/resumes threads, starts turns, and collects streamed text.
- `conversation-repository`: persists `context_key`, `thread_id`, and timestamps.
- `message-router`: decides whether an IRC `PRIVMSG` should reach Codex and
  builds the context key.
- `task-repository`: persists task creation and task channel metadata.
- `codex-bot`: wires IRC events to repositories and the Codex client.

## Testing

Build in vertical slices:

1. Message routing tests for channel `@codex`, direct `@codex`, plain direct
   messages, and ignored channel text.
2. Repository tests for context-key to thread-id persistence.
3. Codex app-client tests with a fake JSON-RPC transport for initialize, login,
   thread creation, streamed deltas, and auth errors.
4. Bot tests using fake socket, fake repository, and fake Codex client.
5. Task-channel tests proving `@orc new` creates `TASK-0001`, joins
   `#task-0001`, and uses a split context.

All source and test files stay under 200 lines.

## Out Of Scope

- OpenAI API-key provider.
- Multi-user cloud hosting.
- Reading Codex auth files directly.
- IRC-triggered shell or file operations.
- Full approval workflow for executable tools.
