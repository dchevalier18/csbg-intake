# CAP Trellis on a Windows office PC (local / offline tier)

The ROADMAP §7 local tier, dependency-free: PowerShell + Task Scheduler + the
embedded database. No PostgreSQL, no Docker, no third-party service wrappers.
Works offline after the initial `npm ci`.

## Install

1. Install [Node.js 20+ LTS](https://nodejs.org) (the installer offers to do
   this via `winget` if it's missing).
2. Get the repository onto the PC (Download ZIP from GitHub works fine —
   extract it somewhere permanent like `C:\CAPTrellis`).
3. In PowerShell, from the repository folder:

   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\windows\install.ps1
   ```

That builds the app, registers **start-at-sign-in** (a scheduled task, or a
Startup-folder launcher when task creation needs admin rights), starts the server,
and opens the **/setup wizard** (agency profile + first administrator — no
demo data on this path).

## Manage

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\manage.ps1
```

A console menu with the §7.2 manager-panel contract:

- **Status** — running/stopped, address, data folder, autostart state
- **Start / Stop / Restart**
- **Change port** (rewrites `.env.local`, restarts)
- **Office-LAN toggle** — "only this computer" (default) vs "other computers
  in this office" (binds the LAN address and manages the Windows Firewall
  rule; shows the URL front-desk machines should use). LAN traffic is plain
  HTTP — use this on trusted office networks only; anything internet-facing
  belongs on the Docker/Caddy tier.
- **Open in browser**, **recent log lines**

## What to back up

Everything lives in the repository's `data\` folder: the embedded database,
uploaded documents, and `server.log`. Copy that folder (with the server
stopped) and you have a full backup; Settings → Database also offers the
JSON full-data export.

## Uninstall

```powershell
schtasks /Delete /F /TN CAPTrellis 2>$null
Remove-Item "$([Environment]::GetFolderPath('Startup'))\CAPTrellis.cmd" -ErrorAction SilentlyContinue
netsh advfirewall firewall delete rule name="CAP Trellis (staff LAN access)"
```

Then delete the folder (or just `data\` to wipe the data but keep the app).

## Known limits of this tier

- The **client portal** needs an internet-reachable deployment — use the
  Docker/Caddy tier for that.
- Single machine, single process (the embedded database is in-process).
- Updates: pull/extract the new version over the folder, re-run
  `install.ps1` (it rebuilds and keeps `.env.local` + `data\`).
