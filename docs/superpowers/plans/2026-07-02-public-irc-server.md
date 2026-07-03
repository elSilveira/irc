# Public IRC Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker Compose deployment for a public TLS-only Ergo IRC server at `irc.eduardosilveira.dev:6697`, with persistent data and backup/restore operations.

**Architecture:** Use `ghcr.io/ergochat/ergo:stable` with host-mounted data, repository-managed Ergo config, and a Certbot Compose profile for certificates. Keep operational scripts and docs in the repo so the deployment can be rebuilt or migrated without losing IRC state.

**Tech Stack:** Docker Compose, Ergo IRCd, Certbot, PowerShell, Markdown.

---

## File Structure

- `.gitignore`: ignore `.env`, `certs/`, `data/`, `backups/`, logs, temp files.
- `.env.example`: document `IRC_DOMAIN`, `ACME_EMAIL`, and `TZ`.
- `compose.yaml`: define `ergo` and profiled `certbot` services.
- `config/ergo/ircd.yaml`: configure EduardoIRC, listeners, TLS, services, and limits.
- `config/ergo/ircd.motd`: connection and registration message.
- `scripts/backup.ps1`: archive config, data, and certs.
- `scripts/restore.ps1`: restore a selected backup archive.
- `README.md`: DNS, firewall, cert, operation, backup, restore, and client guide.

### Task 1: Repository Safety Files

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] Add ignore rules for `.env`, `certs/`, `data/`, `backups/`, logs, temp files, `.DS_Store`, and `Thumbs.db`.
- [ ] Add `.env.example` with:

```dotenv
IRC_DOMAIN=irc.eduardosilveira.dev
ACME_EMAIL=admin@eduardosilveira.dev
TZ=UTC
```

- [ ] Run `git status --short`; expected source files visible and runtime paths ignored.

### Task 2: Docker Compose Stack

**Files:**
- Create: `compose.yaml`

- [ ] Add `ergo` service using `ghcr.io/ergochat/ergo:stable`, restart policy, host-mounted `data/ergo`, `config/ergo`, and read-only cert mount.
- [ ] Publish public TLS IRC on `6697/tcp`; keep plaintext local only if needed for development.
- [ ] Add profiled `certbot` service publishing `80/tcp` only during cert issuance.
- [ ] Run `docker compose config`; expected valid config with `ergo`, profiled `certbot`, and `irc` network.

### Task 3: Ergo Configuration

**Files:**
- Create: `config/ergo/ircd.yaml`
- Create: `config/ergo/ircd.motd`

- [ ] Start from the official Ergo stable default config.
- [ ] Set network name `EduardoIRC` and server name `irc.eduardosilveira.dev`.
- [ ] Configure TLS listener `:6697` using `/etc/letsencrypt/live/irc.eduardosilveira.dev/fullchain.pem` and `privkey.pem`.
- [ ] Configure local plaintext only for loopback development.
- [ ] Enable services, account/channel persistence, rate limits, and connection throttling.
- [ ] Add MOTD:

```text
Welcome to EduardoIRC.
Connect securely with TLS at irc.eduardosilveira.dev:6697.
Register your account with /msg NickServ REGISTER <password>.
Register channels with /msg ChanServ REGISTER #channel.
```

- [ ] Run `Select-String -Path config\ergo\ircd.yaml -Pattern 'EduardoIRC','irc.eduardosilveira.dev','max-concurrent-connections: 8'`.

### Task 4: Backup And Restore Scripts

**Files:**
- Create: `scripts/backup.ps1`
- Create: `scripts/restore.ps1`

- [ ] Add backup script that creates `backups/irc-server-YYYYMMDD-HHMMSS.zip` from `config`, `data`, and `certs`.
- [ ] Add restore script accepting `-ArchivePath`, refusing missing archives, warning if Compose services are running, and extracting into the repo root.
- [ ] Run `powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1`; expected one zip under `backups/`.

### Task 5: Operator Documentation

**Files:**
- Create: `README.md`

- [ ] Document DNS `A` record, firewall ports, `.env` setup, Certbot, operator password hash generation, startup, logs, rehash, backup, restore, and client settings.
- [ ] Mention optional GitHub Pages `/server` page as documentation only.
- [ ] Run `Select-String -Path README.md -Pattern 'DNS','6697','certbot','genpasswd','backup','restore','GitHub Pages'`.

### Task 6: Final Verification

**Files:**
- Validate all created files.

- [ ] Run `docker compose config`; expected exit code `0`.
- [ ] Run `git check-ignore .env certs data backups`; expected all four paths printed.
- [ ] Run `git status --short`; expected source/config/docs/scripts visible and runtime data ignored.
- [ ] Commit with `git add .` then `git commit -m "feat: add dockerized public irc server"` after verification passes.
