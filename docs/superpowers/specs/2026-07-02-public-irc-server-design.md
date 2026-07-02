# Public IRC Server Design

## Goal

Create a Dockerized public IRC server reachable at `irc.eduardosilveira.dev:6697`, with TLS-only client access, persistent data, operational backup/restore guidance, and secure defaults suitable for exposure on the public internet.

The existing `eduardosilveira.dev` GitHub Pages site will remain separate. A future `/server` page can link to the IRC endpoint and show connection instructions, but IRC traffic itself must use a hostname and port rather than an HTTP path.

## Chosen Approach

Use Ergo IRCd in Docker Compose.

Ergo is a good fit because it provides a modern IRC daemon with integrated account and channel services, straightforward configuration, and a single primary service to operate. This keeps the deployment simpler than InspIRCd plus Anope while still supporting persistent accounts, channels, operators, and public-server controls.

## DNS And Network

- Public client hostname: `irc.eduardosilveira.dev`
- Public client port: `6697`
- DNS requirement: create an `A` record for `irc.eduardosilveira.dev` pointing to the server public IPv4 address. Add an `AAAA` record only if the host has stable IPv6.
- Firewall requirement: allow inbound TCP `6697`. Allow HTTP/HTTPS only if using an HTTP-based ACME challenge or adding a landing/status service later.
- Plaintext IRC port `6667` is not exposed by default.

## Docker Architecture

The repository will contain:

- `compose.yaml`: services, volumes, networks, restart policy, published ports.
- `config/ergo/ircd.yaml`: Ergo IRCd configuration template.
- `.env.example`: required deployment variables such as domain and email.
- `scripts/backup.ps1`: creates timestamped backups of persistent config and data.
- `scripts/restore.ps1`: restores a selected backup archive.
- `README.md`: setup, DNS, firewall, startup, backup, restore, and connection instructions.

TLS certificate handling will be implemented with persistent certificate storage. The preferred implementation is a Certbot container or documented host Certbot flow that writes certificates into `certs/letsencrypt`, mounted read-only by Ergo where possible.

## Persistent Data

The server must preserve all operational state across container restarts and host redeployments.

Persistent directories:

- `config/ergo`: server configuration.
- `data/ergo`: Ergo database, account state, channel registrations, and runtime state.
- `certs/letsencrypt`: TLS certificates.
- `backups`: timestamped backup archives.

Backups must include at least `config/ergo`, `data/ergo`, and certificate material or clear instructions to reissue certificates. Restore instructions must stop the server before replacing state.

## Security Defaults

The deployment will default to:

- TLS-only public IRC access on port `6697`.
- No public plaintext IRC listener.
- Docker restart policy for service recovery after reboot.
- Isolated Docker network for internal service communication.
- Persistent volumes/directories with limited scope.
- IRC server rate limits and connection throttling.
- Operator credentials generated out of band and stored as a hashed password in config, not as plaintext.
- Server name and network name set explicitly.
- Registration, account, and channel services enabled so channel ownership survives restarts.
- Documentation warning that public IRC also requires host-level firewalling, OS updates, and regular backups.

## Operations

Initial setup flow:

1. Create DNS record for `irc.eduardosilveira.dev`.
2. Copy `.env.example` to `.env` and fill in the deployment values.
3. Generate an operator password hash.
4. Start the stack with Docker Compose.
5. Confirm TLS IRC connection on `irc.eduardosilveira.dev:6697`.
6. Run a backup and verify an archive appears under `backups`.

Restore flow:

1. Stop the Docker Compose stack.
2. Restore the selected archive into the workspace.
3. Start the stack.
4. Confirm accounts/channels persist.

## Testing And Verification

Implementation verification should include:

- Docker Compose config validation.
- Config file syntax validation if the Ergo image supports it directly.
- Confirmation that required persistent directories exist.
- Backup script smoke test.
- Documentation review for DNS, firewall, startup, backup, restore, and connection steps.

Full live verification of TLS issuance and external connectivity requires a real server IP with DNS pointing at it.

## Out Of Scope

- A web IRC client.
- Multi-server IRC network linking.
- Automated VPS provisioning.
- GitHub Pages `/server` implementation in this workspace.
