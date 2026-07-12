# CAP Trellis server runner — invoked by the 'CAPTrellis' logon task.
# Reads PORT/HOSTNAME from .env.local, restarts the server if it crashes,
# and appends output to data\server.log.
$ErrorActionPreference = "Continue"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

New-Item -ItemType Directory -Force -Path "data" | Out-Null
$log = Join-Path $Root "data\server.log"

function Read-EnvVal($name, $default) {
  if (Test-Path ".env.local") {
    $line = Select-String -Path ".env.local" -Pattern "^$name=" | Select-Object -First 1
    if ($line) { return $line.Line.Split("=", 2)[1].Trim() }
  }
  return $default
}

while ($true) {
  $port = Read-EnvVal "PORT" "3100"
  $hostname = Read-EnvVal "HOSTNAME" "127.0.0.1"
  Add-Content $log "[$(Get-Date -Format o)] starting CAP Trellis on ${hostname}:${port}"
  $env:PORT = $port
  $env:HOSTNAME = $hostname
  # next start reads .env.local itself for DATABASE_URL etc.
  & npx next start -p $port -H $hostname *>> $log
  Add-Content $log "[$(Get-Date -Format o)] server exited (code $LASTEXITCODE) - restarting in 5s"
  Start-Sleep -Seconds 5
}
