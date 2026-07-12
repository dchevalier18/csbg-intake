# CAP Trellis — Windows local install (offline-capable, embedded database)
# Run from an elevated-or-normal PowerShell in the repo root:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\install.ps1
#
# What it does:
#   1. Verifies Node.js 20+ (offers winget install if missing)
#   2. npm ci + production build with the EMBEDDED database (no PostgreSQL)
#   3. Writes .env.local (embedded DB under .\data, production seed => /setup wizard)
#   4. Registers a logon task so the server starts automatically
#   5. Starts the server and opens http://localhost:3100
# Manage afterward with: powershell -File deploy\windows\manage.ps1

$ErrorActionPreference = "Stop"
$AppName = "CAP Trellis"
$TaskName = "CAPTrellis"
$Port = 3100

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- locate repo root (this script lives in deploy\windows) ---
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
if (-not (Test-Path "package.json")) { throw "Run this from the CAP Trellis repository (package.json not found at $Root)." }

# --- 1. Node.js ---
Step "Checking Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js is not installed." -ForegroundColor Yellow
  $ans = Read-Host "Install Node.js LTS with winget now? (y/n)"
  if ($ans -eq "y") {
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Write-Host "Close this window and re-run the installer in a NEW PowerShell (so PATH refreshes)." -ForegroundColor Yellow
    exit 0
  } else {
    throw "Install Node.js 20+ from https://nodejs.org and re-run."
  }
}
$nodeVersion = (node --version).TrimStart("v").Split(".")[0]
if ([int]$nodeVersion -lt 20) { throw "Node.js 20+ required (found $(node --version))." }
Write-Host "    Node $(node --version) OK"

# --- 2. Environment file (embedded DB, production init => /setup wizard) ---
Step "Writing .env.local (embedded database, setup wizard on first visit)"
if (-not (Test-Path ".env.local")) {
  @"
# CAP Trellis — local Windows install (managed by deploy\windows)
DATABASE_URL=pglite://./data/pglite
CSBG_DEMO_SEED=0
PORT=$Port
# LAN access is off by default — use manage.ps1 to turn it on
HOSTNAME=127.0.0.1
# This tier serves plain HTTP on a trusted office network (no TLS terminator),
# so the Secure cookie flag + HSTS are disabled. Internet-facing deployments
# use the Docker/Caddy tier instead.
CSBG_ALLOW_HTTP=1
"@ | Set-Content ".env.local" -Encoding UTF8
} else {
  Write-Host "    .env.local already exists - leaving it alone"
}

# --- 3. Install + build ---
Step "Installing dependencies (this can take a few minutes)"
npm ci
Step "Building the production server"
npm run build

# --- 4. Start-at-logon task ---
Step "Registering the start-at-logon task '$TaskName'"
$runner = Join-Path $Root "deploy\windows\run-server.ps1"
schtasks /Create /F /TN $TaskName /SC ONLOGON /TR "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`"" | Out-Null
Write-Host "    The server will start automatically when you sign in to Windows."

# --- 5. Start now ---
Step "Starting $AppName"
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 3
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { break }
  } catch { Start-Sleep -Seconds 2 }
}

Write-Host ""
Write-Host "$AppName is installed." -ForegroundColor Green
Write-Host "Opening http://localhost:$Port - the /setup wizard creates your agency and first administrator."
Write-Host "Day-to-day management: powershell -File deploy\windows\manage.ps1"
Start-Process "http://localhost:$Port"
