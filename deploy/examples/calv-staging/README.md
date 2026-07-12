# Staging deployment — 10.55.1.13 (`caclv-data-dev`, shared Ubuntu box)

The app runs as a systemd service (`csbg-intake`, Next.js on `127.0.0.1:3100`,
**running as the `dchevalier` user**) behind an Apache reverse-proxy vhost on
port 80. PostgreSQL (already on the box) hosts a dedicated `csbg_intake`
database, **localhost-only** — the app connects over `localhost`.

This box also hosts other apps (`checklog`, `sage-integration-hub`). Everything
here is **additive and non-destructive**: a new vhost (other sites and
`000-default` untouched), a new database + role (the shared Postgres instance is
not reconfigured or restarted), a new systemd unit, and a narrow sudoers rule.

## First-time setup
1. From the workstation, stage the provisioning scripts to the server (no sudo):
   ```powershell
   ssh dev "mkdir -p ~/csbg-deploy"
   scp deploy/provision.sh deploy/apache-csbg-intake.conf deploy/csbg-intake.service dev:csbg-deploy/
   ```
2. On the server, run provisioning once (the only step needing a password):
   ```
   ssh -t dev "sudo bash ~/csbg-deploy/provision.sh"
   ```
   Creates the `csbg` role + `csbg_intake` DB (password generated once into
   `/etc/csbg-intake.env`), the Apache vhost, the systemd unit, `/opt/csbg-intake`
   owned by `dchevalier`, and a NOPASSWD rule for `systemctl … csbg-intake` only.
3. From the workstation: `.\deploy\deploy.ps1` — packs, ships, builds, and starts
   the service (no password). Browse to `http://10.55.1.13/`. First boot
   bootstraps the schema and seeds demo data (logins dana/marcus/luz/robin/joan/
   terrence · `demo1234`).

## Day-to-day
- **Deploy a change:** `.\deploy\deploy.ps1`
- **Reseed demo data:** `ssh dev "cd /opt/csbg-intake && set -a && . /etc/csbg-intake.env && set +a && npm run seed"`
- **Logs:** `ssh dev "journalctl -u csbg-intake -f"` · Apache: `/var/log/apache2/csbg-intake-*.log`
- **Backups:** Settings → Database → "Back up now" runs `pg_dump` into `/opt/csbg-intake/data/backups`.

## Developing against this database from your workstation
The staging Postgres is localhost-only, so a dev workstation can't reach it yet.
To enable it deliberately: open `listen_addresses` + a scoped `pg_hba` rule for
the 10.55.0.0/16 LAN and restart Postgres (**this briefly bounces the shared
instance's other databases**). Ask and it's a one-time change; then point
`.env.local` `DATABASE_URL` at `postgres://csbg:…@10.55.1.13:5432/csbg_intake`.

Notes: the vhost answers `csbg-intake.caclv.org` and the raw IP. `CSBG_ALLOW_HTTP=1`
keeps the session cookie non-Secure because staging is plain HTTP — drop it when
TLS is added.
