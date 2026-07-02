# Public IRC Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker Compose deployment for a public TLS-only Ergo IRC server at `irc.eduardosilveira.dev:6697`, with persistent data and backup/restore operations.

**Architecture:** Use the official `ghcr.io/ergochat/ergo:stable` image with a host-mounted `/ircd` data directory and a repository-managed Ergo config. Use a one-shot Certbot Compose profile to issue certificates into persistent `certs/letsencrypt`, mounted read-only into the Ergo container. Keep operational scripts and documentation in the repo so the deployment can be rebuilt or migrated without losing IRC state.

**Tech Stack:** Docker Compose, Ergo IRCd, Certbot, PowerShell operational scripts, Markdown docs.

---

## File Structure

- `.gitignore`: excludes local secrets, generated certs, server databases, backups, logs, and temporary files.
- `.env.example`: documents deployment variables for the domain and ACME email.
- `compose.yaml`: defines the `ergo` service and a `certbot` profile for certificate issuance/renewal.
- `config/ergo/ircd.yaml`: official Ergo default config customized for `irc.eduardosilveira.dev`, TLS-only public access, persistent services, and public-server throttling.
- `config/ergo/ircd.motd`: message shown to users on connect.
- `scripts/backup.ps1`: creates timestamped backup archives of config, data, and certificates.
- `scripts/restore.ps1`: restores one backup archive after the stack is stopped.
- `README.md`: deployment, DNS, firewall, cert, operation, backup, and restore guide.

### Task 1: Repository Safety Files

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Add ignore rules for local and persistent runtime data**

Create `.gitignore` with generated deployment artifacts excluded:

```gitignore
.env
certs/
data/
backups/
*.log
*.tmp
*.bak
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Add documented environment template**

Create `.env.example`:

```dotenv
IRC_DOMAIN=irc.eduardosilveira.dev
ACME_EMAIL=admin@eduardosilveira.dev
TZ=UTC
```

- [ ] **Step 3: Verify Git sees only source files**

Run: `git status --short`

Expected: `.gitignore`, `.env.example`, docs, and later source/config files appear; no `data/`, `certs/`, or `backups/` entries are tracked.

### Task 2: Docker Compose Stack

**Files:**
- Create: `compose.yaml`

- [ ] **Step 1: Add Compose services**

Create `compose.yaml`:

```yaml
services:
  ergo:
    image: ghcr.io/ergochat/ergo:stable
    container_name: ergo-ircd
    init: true
    restart: unless-stopped
    environment:
      TZ: ${TZ:-UTC}
    ports:
      - "6697:6697/tcp"
    volumes:
      - ./data/ergo:/ircd
      - ./config/ergo/ircd.yaml:/ircd/ircd.yaml:ro
      - ./config/ergo/ircd.motd:/ircd/ircd.motd:ro
      - ./certs/letsencrypt:/etc/letsencrypt:ro
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    networks:
      - irc

  certbot:
    image: certbot/certbot:latest
    profiles:
      - certbot
    ports:
      - "80:80/tcp"
    volumes:
      - ./certs/letsencrypt:/etc/letsencrypt
      - ./certs/lib:/var/lib/letsencrypt
      - ./certs/log:/var/log/letsencrypt
    entrypoint: certbot
    networks:
      - irc

networks:
  irc:
    driver: bridge
```

- [ ] **Step 2: Validate Compose syntax**

Run: `docker compose config`

Expected: Compose renders one `ergo` service, one profiled `certbot` service, one `irc` network, and only port `6697` published by the always-on IRC service.

### Task 3: Ergo Configuration

**Files:**
- Create: `config/ergo/ircd.yaml`
- Create: `config/ergo/ircd.motd`

- [ ] **Step 1: Start from official Ergo stable default config**

Fetch the official stable `default.yaml` from `ergochat/ergo` and save it as `config/ergo/ircd.yaml`.

- [ ] **Step 2: Customize required public-server settings**

Patch these settings:

```yaml
network:
  name: EduardoIRC

server:
  name: irc.eduardosilveira.dev
  listeners:
    "127.0.0.1:6667":
    "[::1]:6667":
    ":6697":
      tls:
        cert: /etc/letsencrypt/live/irc.eduardosilveira.dev/fullchain.pem
        key: /etc/letsencrypt/live/irc.eduardosilveira.dev/privkey.pem
      proxy: false
      min-tls-version: 1.2
  motd: ircd.motd
  sts:
    enabled: true
    duration: 1mo2d5m
    port: 6697
    preload: false
  ip-limits:
    count: true
    max-concurrent-connections: 8
    throttle: true
    window: 10m
    max-connections-per-window: 16
```

Replace the example operator password hash with a placeholder hash and document that it must be replaced with output from `docker compose run --rm ergo genpasswd` before public launch.

- [ ] **Step 3: Add MOTD**

Create `config/ergo/ircd.motd`:

```text
Welcome to EduardoIRC.

Connect securely with TLS at irc.eduardosilveira.dev:6697.
Register your account with /msg NickServ REGISTER <password>.
Register channels with /msg ChanServ REGISTER #channel.
```

- [ ] **Step 4: Verify key config values are present**

Run: `Select-String -Path config\ergo\ircd.yaml -Pattern 'EduardoIRC','irc.eduardosilveira.dev','/etc/letsencrypt/live/irc.eduardosilveira.dev','max-concurrent-connections: 8'`

Expected: each pattern is found in `config/ergo/ircd.yaml`.

### Task 4: Backup And Restore Scripts

**Files:**
- Create: `scripts/backup.ps1`
- Create: `scripts/restore.ps1`

- [ ] **Step 1: Add backup script**

Create `scripts/backup.ps1` to archive `config`, `data`, and `certs` into `backups/irc-server-YYYYMMDD-HHMMSS.zip`.

- [ ] **Step 2: Add restore script**

Create `scripts/restore.ps1` accepting `-ArchivePath`, refusing missing archives, warning if Docker Compose services are still running, then extracting into the repository root.

- [ ] **Step 3: Smoke-test backup script**

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1`

Expected: creates one zip archive under `backups/` even before live IRC data exists.

### Task 5: Operator Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Document deployment**

Create `README.md` covering:

- DNS `A` record for `irc.eduardosilveira.dev`.
- Firewall ports: `6697/tcp` always, `80/tcp` only during HTTP-01 cert issuance/renewal.
- `.env` setup.
- Certificate issuance with the `certbot` profile.
- Operator password hash generation.
- Start, stop, logs, rehash, backup, and restore commands.
- Client connection settings and the optional GitHub Pages `/server` page.

- [ ] **Step 2: Review docs for launch blockers**

Run: `Select-String -Path README.md -Pattern 'DNS','6697','certbot','genpasswd','backup','restore','GitHub Pages'`

Expected: each required operational topic appears.

### Task 6: Final Verification

**Files:**
- Validate all created files.

- [ ] **Step 1: Render Compose config**

Run: `docker compose config`

Expected: exit code `0`.

- [ ] **Step 2: Check ignored runtime paths**

Run: `git check-ignore .env certs data backups`

Expected: all four paths are printed.

- [ ] **Step 3: Check repository status**

Run: `git status --short`

Expected: source/config/docs/scripts are visible; runtime data remains ignored.

- [ ] **Step 4: Commit if verification passes**

Run:

```powershell
git add .
git commit -m "feat: add dockerized public irc server"
```

Expected: one initial commit containing the server scaffold.
