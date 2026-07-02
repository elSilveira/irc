# EduardoIRC

Dockerized Ergo IRCd deployment for a public IRC server at:

```text
irc.eduardosilveira.dev:6697
```

Normal client access is TLS-only. The plaintext IRC port `6667` is not published by Docker.

## What Is Included

- Ergo IRCd using `ghcr.io/ergochat/ergo:stable`
- Docker Compose service for the IRC server
- Certbot Compose profile for Let's Encrypt certificates
- Persistent host directories for IRC state, config, certs, and backups
- Backup and restore scripts
- Public-server defaults for TLS, IP cloaking, account services, channel registration, and connection throttling

Ergo's Docker documentation says the image stores its config at `/ircd/ircd.yaml`. This deployment overlays the repo-managed config file there and stores persistent database state under `./data/ergo`, mounted at `/ircd-data`.

## DNS

Create this DNS record at your DNS provider:

```text
irc.eduardosilveira.dev.  A  <your-server-ipv4>
```

Add an `AAAA` record only if the server has stable IPv6.

Do not try to use `eduardosilveira.dev/server` for IRC traffic. IRC clients connect to a hostname and port, not an HTTP path. You can still create a GitHub Pages page at `eduardosilveira.dev/server` with instructions and a link to:

```text
ircs://irc.eduardosilveira.dev:6697
```

## Firewall

Allow:

```text
6697/tcp
```

Allow `80/tcp` only while issuing or renewing Let's Encrypt certificates with HTTP-01 challenge. Close it again after issuance if you do not run a website on this host.

## Setup

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set:

```dotenv
IRC_DOMAIN=irc.eduardosilveira.dev
ACME_EMAIL=your-real-email@example.com
TZ=UTC
```

## Issue TLS Certificate

Make sure DNS points to this server before running Certbot.

```powershell
docker compose --profile certbot run --rm --service-ports certbot certonly --standalone -d irc.eduardosilveira.dev -m your-real-email@example.com --agree-tos --no-eff-email
```

Certificates are preserved under:

```text
certs/letsencrypt/
```

Renew manually:

```powershell
docker compose --profile certbot run --rm --service-ports certbot renew --standalone
docker compose kill -s HUP ergo
```

For unattended production renewal, schedule those two commands with Task Scheduler, cron, or your host's preferred scheduler.

## Local Test Certificate

For local testing before DNS and Let's Encrypt are ready, create a short-lived self-signed certificate:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-cert.ps1
```

This certificate is for local development only. IRC clients may show a certificate warning; accept it for local testing, then replace it with a real Let's Encrypt certificate before public launch.

## Operator Password

Before public launch, replace the example operator password hash in `config/ergo/ircd.yaml`.

Generate a hash:

```powershell
docker compose run --rm ergo genpasswd
```

Paste the generated hash into:

```yaml
opers:
  admin:
    password: "<generated-hash>"
```

Then become an operator from an IRC client with:

```text
/OPER admin <your-operator-password>
```

## Start And Stop

Start:

```powershell
docker compose up -d
```

Logs:

```powershell
docker compose logs -f ergo
```

Reload Ergo config and TLS certificates without disconnecting users when supported by the changed setting:

```powershell
docker compose kill -s HUP ergo
```

Stop:

```powershell
docker compose down
```

## Client Settings

Use these settings in HexChat, WeeChat, irssi, The Lounge, or another IRC client:

```text
Server: irc.eduardosilveira.dev
Port: 6697
TLS/SSL: enabled
Plaintext: disabled
```

Register an account:

```text
/msg NickServ REGISTER <password>
```

Register a channel after joining it while logged in:

```text
/msg ChanServ REGISTER #channel
```

## Persistence

Important state is stored outside the container:

```text
config/ergo/          Ergo config and MOTD
data/ergo/            Ergo database, accounts, channels, runtime state
certs/letsencrypt/    TLS certificates
backups/              Backup archives
```

The container can be removed and recreated without losing IRC accounts or registered channels as long as these directories are preserved.

## Backup

Create a timestamped backup:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
```

Archives are written to:

```text
backups/
```

Copy backup archives off the server regularly. Local-only backups do not protect against host loss.

## Restore

Stop the stack first:

```powershell
docker compose down
```

Restore an archive:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1 -ArchivePath .\backups\irc-server-YYYYMMDD-HHMMSS.zip
```

Start the stack again:

```powershell
docker compose up -d
```

## Validation

Render the Compose file:

```powershell
docker compose config
```

Check that runtime paths are ignored by Git:

```powershell
git check-ignore .env certs data backups
```

Check important Ergo config values:

```powershell
Select-String -Path config\ergo\ircd.yaml -Pattern 'EduardoIRC','irc.eduardosilveira.dev','/etc/letsencrypt/live/irc.eduardosilveira.dev','max-concurrent-connections: 8'
```

## References

- Ergo Docker docs: https://github.com/ergochat/ergo/blob/master/distrib/docker/README.md
- Ergo manual: https://github.com/ergochat/ergo/blob/master/docs/MANUAL.md
- Ergo default config: https://github.com/ergochat/ergo/blob/stable/default.yaml
