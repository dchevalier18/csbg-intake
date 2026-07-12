# CAP Trellis — Windows local install (offline-capable, embedded database)
# Run from a normal PowerShell in the repo root:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\install.ps1
#
# What it does:
#   1. Verifies Node.js 20+ (offers winget install if missing)
#   2. Writes .env.local (embedded database under .\data, /setup wizard on first visit)
#   3. npm ci + production build — the install STOPS with a clear error if either fails
#   4. Registers autostart: a logon scheduled task, or (no-admin fallback) a
#      launcher in your Startup folder
#   5. Starts the server, waits for it to answer, then opens the browser
# Manage afterward with: powershell -File deploy\windows\manage.ps1

$ErrorActionPreference = "Stop"
$AppName = "CAP Trellis"
$TaskName = "CAPTrellis"
$Port = 3100

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host ""; Write-Host "INSTALL FAILED: $msg" -ForegroundColor Red; exit 1 }

# --- locate repo root (this script lives in deploy\windows) ---
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
if (-not (Test-Path "package.json")) { Fail "Run this from the CAP Trellis repository (package.json not found at $Root)." }

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
    Fail "Install Node.js 20+ from https://nodejs.org and re-run."
  }
}
$nodeVersion = (node --version).TrimStart("v").Split(".")[0]
if ([int]$nodeVersion -lt 20) { Fail "Node.js 20+ required (found $(node --version))." }
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
# the embedded database + uploads live here; pre-create so nothing else has to
New-Item -ItemType Directory -Force -Path "data\pglite" | Out-Null

# --- 3. Install + build (stop on failure) ---
Step "Installing dependencies (this can take a few minutes)"
npm ci
if ($LASTEXITCODE -ne 0) { Fail "npm ci exited with code $LASTEXITCODE - fix the errors above and re-run." }
Step "Building the production server"
# build-time page data comes from a throwaway in-memory engine — parallel
# build workers must never open the real on-disk database (process env
# beats .env.local, so this overrides it for the build only)
$env:DATABASE_URL = "pglite://memory"
$env:CSBG_DEMO_SEED = "0"
$env:NEXT_TELEMETRY_DISABLED = "1"
npm run build
Remove-Item Env:DATABASE_URL, Env:CSBG_DEMO_SEED -ErrorAction SilentlyContinue
if ($LASTEXITCODE -ne 0) { Fail "the build failed (see errors above). Nothing was registered - fix and re-run." }

# --- 4. Autostart: scheduled task, or Startup-folder fallback (no admin needed) ---
Step "Registering autostart"
$runner = Join-Path $Root "deploy\windows\run-server.ps1"
$runnerCmd = "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`""
$autostart = ""
schtasks /Create /F /TN $TaskName /SC ONLOGON /TR $runnerCmd 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  $autostart = "task"
  Write-Host "    Logon task '$TaskName' registered."
} else {
  # ONLOGON tasks need elevation on many machines — the per-user Startup
  # folder needs none and does the same job
  $startupDir = [Environment]::GetFolderPath("Startup")
  $launcher = Join-Path $startupDir "CAPTrellis.cmd"
  "@echo off`r`nstart `"CAPTrellis`" /min $runnerCmd" | Set-Content $launcher -Encoding ASCII
  $autostart = "startup"
  Write-Host "    No permission for a scheduled task - placed a launcher in your Startup folder instead:"
  Write-Host "    $launcher"
}
Write-Host "    The server will start automatically when you sign in to Windows."

# --- 5. Start now and verify ---
Step "Starting $AppName"
if ($autostart -eq "task") {
  schtasks /Run /TN $TaskName | Out-Null
} else {
  Start-Process powershell -ArgumentList "-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",$runner -WindowStyle Hidden
}

$up = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $up = $true; break }
  } catch { Start-Sleep -Seconds 2 }
}

if (-not $up) {
  Fail "the server did not answer on http://localhost:$Port within 90 seconds. Check data\server.log for details, then try: powershell -File deploy\windows\manage.ps1"
}

Write-Host ""
Write-Host "$AppName is installed and running." -ForegroundColor Green
Write-Host "Opening http://localhost:$Port - the /setup wizard creates your agency and first administrator."
Write-Host "Day-to-day management: powershell -File deploy\windows\manage.ps1"
Start-Process "http://localhost:$Port"
