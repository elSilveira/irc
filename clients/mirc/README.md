# mIRC Helper

Load the helper script in mIRC:

```text
/load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
```

Then connect locally. This uses `127.0.0.1:6667` without TLS to avoid local
self-signed certificate verification issues in mIRC:

```text
/eduardoirc
```

Other aliases:

```text
/eduardoirc-lan
/eduardoirc-public
```

The LAN and public aliases use `+6697`, which tells mIRC to connect with
SSL/TLS.

If mIRC shows `SSL certificate verify failed`, trust the local self-signed
development certificate for the current Windows user:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\trust-dev-cert.ps1
```

Then stop the retry loop and reconnect with `/eduardoirc-lan` or
`/eduardoirc-public`.

If mIRC says `Using STS secure port +6697` while you are trying `/eduardoirc`,
clear the cached local STS upgrade:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\clear-mirc-sts.ps1
```

Restart mIRC after clearing the cache.

## Registered Nicknames

If you see `NICKNAME_RESERVED`, the nick belongs to an account and you must
identify before using it:

```text
/ns-identify your-account-password
```

For a new nick, switch first and then register:

```text
/use-nick eduardo-test
/ns-register new-account-password
```

## Codex Agent

Start the local `codex-agent` bridge. It talks to local `codex app-server`, so
Codex owns login, tokens, model access, and streamed responses:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-codex-agent.ps1
```

Then use these mIRC shortcuts in `#control`:

```text
/codex-login
/codex-status
/codex-help
/codex-echo hello from mIRC
```

Run `/codex-login` first if Codex is not signed in. The bot replies with the
browser login URL returned by `codex app-server`.

Use `@codex <message>` in any channel. Direct messages to `codex-agent` also
work without the `@codex` prefix. Context is persisted separately per channel
and direct message, for example `channel:#control`, `channel:#task-0001`, and
`dm:esilveira`.

The agent is chat-only and cannot run shell, edit files, use Git, browse,
deploy, or access secrets from IRC.

## Control Plane Shortcuts

All control-plane aliases send `@orc` commands to `#control`.

```text
/orc-agents
/orc-status
/orc-tasks
/orc-new Build local IRC control plane
/orc-agent-create researcher-agent researcher researcher Finds missing context
/orc-assign TASK-0001 manager-agent
/orc-join TASK-0001 coder-agent
/orc-summarize TASK-0001
/orc-logs TASK-0001
```

`/orc-new` sends `@orc new`, creates a task such as `TASK-0001`, and makes the
bot join the split channel `#task-0001` for that task context.

`/orc-agent-create` stores agent identity and context through the orchestrator:

```text
/orc-agent-create researcher-agent researcher researcher Finds missing context and proposes research steps
```

If repeated retries caused server throttling, restart the server before trying again:

```powershell
docker compose restart ergo
```
