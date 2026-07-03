# EduardoIRC

Dockerized Ergo IRCd deployment plus the first local IRC agent control-plane
primitives. Public client access is TLS-only at `irc.eduardosilveira.dev:6697`;
Docker publishes plaintext `6667` on host loopback only for local development.

## What Is Included

- Ergo IRCd with `ghcr.io/ergochat/ergo:stable`
- Docker Compose service for the IRC server
- Certbot Compose profile for Let's Encrypt certificates
- Persistent host directories for server state, config, certs, and backups
- Backup, restore, start, and local certificate scripts
- mIRC helper aliases in `clients/mirc/eduardoirc.mrc`
- Initial Node control-plane modules under `packages/orchestrator`

## Layout

```text
compose.yaml                  Docker services
config/ergo/                  Ergo config and MOTD
scripts/                      PowerShell operations scripts
clients/mirc/                 mIRC connection and @orc shortcuts
db/schema.sql                 Control-plane database schema
packages/orchestrator/        Tested command and persistence primitives
```

## Setup

```powershell
Copy-Item .env.example .env
```

```dotenv
IRC_DOMAIN=irc.eduardosilveira.dev
ACME_EMAIL=your-real-email@example.com
TZ=UTC
```

For production, create `irc.eduardosilveira.dev. A <your-server-ipv4>`. Allow
inbound `6697/tcp`; allow `80/tcp` only during HTTP-01 certificate work.

## TLS

```powershell
docker compose --profile certbot run --rm --service-ports certbot certonly --standalone -d irc.eduardosilveira.dev -m your-real-email@example.com --agree-tos --no-eff-email
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-cert.ps1
```

## Operator Password

Before public launch, replace the example operator password hash in
`config/ergo/ircd.yaml`, then use `/OPER admin <password>` from IRC.

```powershell
docker compose run --rm ergo genpasswd
```

## Start And Stop

```powershell
docker compose up -d
docker compose logs -f ergo
docker compose kill -s HUP ergo
docker compose down
```

## Client Settings

Use these settings in HexChat, WeeChat, irssi, The Lounge, mIRC, or another IRC
client:

```text
Server: irc.eduardosilveira.dev
Port: 6697
TLS/SSL: enabled
Plaintext: disabled
```

```text
/msg NickServ REGISTER <password>
/msg ChanServ REGISTER #channel
```

## mIRC Shortcuts

```text
/load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
/eduardoirc
/eduardoirc-lan
/eduardoirc-public
```

`/eduardoirc` uses local plaintext `127.0.0.1:6667`. LAN and public aliases use
TLS on `6697`.

Control-plane shortcuts send commands to `#control`:

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

The current implemented command primitive is `@orc agent create`, which stores
agent identity and context in SQLite through the orchestrator repository.

## Control Plane Status

Implemented:

- `@orc` command parsing
- `@orc agent create ...` command handling
- SQLite-backed agent persistence with durable context
- task ID and task-channel formatting helpers
- structured agent message formatting
- v0 permission policy that blocks execution capabilities

Not implemented yet:

- live IRC bot connection
- channel joins/invites
- task creation persistence
- agent auto-replies
- approval workflow

```powershell
npm test
```

## Persistence

```text
config/ergo/          Ergo config and MOTD
data/ergo/            Ergo database, accounts, channels, runtime state
certs/letsencrypt/    TLS certificates
backups/              Backup archives
db/schema.sql         Control-plane schema
```

The `agents` table includes durable `context` so each agent can keep its role
and operating notes across restarts.

## Backup And Restore

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
docker compose down
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1 -ArchivePath .\backups\irc-server-YYYYMMDD-HHMMSS.zip
docker compose up -d
```

## Validation

```powershell
docker compose config
git check-ignore .env certs data backups
Select-String -Path config\ergo\ircd.yaml -Pattern 'EduardoIRC','irc.eduardosilveira.dev','max-concurrent-connections: 8'
npm test
```

## References

- Ergo Docker docs: https://github.com/ergochat/ergo/blob/master/distrib/docker/README.md
- Ergo manual: https://github.com/ergochat/ergo/blob/master/docs/MANUAL.md
- Ergo default config: https://github.com/ergochat/ergo/blob/stable/default.yaml
