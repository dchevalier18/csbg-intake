# CAP Trellis — server manager (Windows local install)
# The ROADMAP §7.2 management panel as a dependency-free console menu:
# status, start/stop/restart, change port, LAN reachability toggle
# (with the firewall rule), open the app, show the backup/data folder.
#   powershell -ExecutionPolicy Bypass -File deploy\windows\manage.ps1

$ErrorActionPreference = "Stop"
$TaskName = "CAPTrellis"
$FirewallRule = "CAP Trellis (staff LAN access)"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

function Read-EnvVal($name, $default) {
  if (Test-Path ".env.local") {
    $line = Select-String -Path ".env.local" -Pattern "^$name=" | Select-Object -First 1
    if ($line) { return $line.Line.Split("=", 2)[1].Trim() }
  }
  return $default
}

function Write-EnvVal($name, $value) {
  $lines = @()
  if (Test-Path ".env.local") { $lines = Get-Content ".env.local" | Where-Object { $_ -notmatch "^$name=" } }
  $lines += "$name=$value"
  $lines | Set-Content ".env.local" -Encoding UTF8
}

function Get-Port { [int](Read-EnvVal "PORT" "3100") }

function Get-ServerUp {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$(Get-Port)/login" -UseBasicParsing -TimeoutSec 3
    return $r.StatusCode -eq 200
  } catch { return $false }
}

function Stop-Server {
  schtasks /End /TN $TaskName 2>$null | Out-Null
  # the runner loop + next server are child processes; end anything on our port
  $port = Get-Port
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Start-Server { schtasks /Run /TN $TaskName | Out-Null }

function Show-Status {
  $port = Get-Port
  $hostname = Read-EnvVal "HOSTNAME" "127.0.0.1"
  $up = Get-ServerUp
  $lan = $hostname -eq "0.0.0.0"
  Write-Host ""
  Write-Host ("  Server:     " + ($(if ($up) { "RUNNING" } else { "STOPPED" }))) -ForegroundColor $(if ($up) { "Green" } else { "Yellow" })
  Write-Host  "  Address:    http://localhost:$port"
  if ($lan) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
    Write-Host "  Office LAN: ON - other computers use http://${ip}:$port" -ForegroundColor Cyan
  } else {
    Write-Host "  Office LAN: off (this computer only)"
  }
  Write-Host  "  Data:       $Root\data  (database + uploads + server.log - BACK THIS FOLDER UP)"
  Write-Host  "  Autostart:  task '$TaskName' runs when you sign in to Windows"
  Write-Host ""
}

while ($true) {
  Show-Status
  Write-Host "  1. Start          4. Change port"
  Write-Host "  2. Stop           5. Turn office-LAN access ON/OFF"
  Write-Host "  3. Restart        6. Open CAP Trellis in the browser"
  Write-Host "  7. Show recent log lines                q. Quit"
  $choice = Read-Host "Choose"
  switch ($choice) {
    "1" { Start-Server; Start-Sleep 3 }
    "2" { Stop-Server }
    "3" { Stop-Server; Start-Sleep 1; Start-Server; Start-Sleep 3 }
    "4" {
      $new = Read-Host "New port (1024-65535)"
      if ($new -match "^\d+$" -and [int]$new -ge 1024 -and [int]$new -le 65535) {
        Write-EnvVal "PORT" $new
        Write-Host "Port set to $new - restarting"; Stop-Server; Start-Sleep 1; Start-Server
      } else { Write-Host "Not a valid port." -ForegroundColor Yellow }
    }
    "5" {
      $current = Read-EnvVal "HOSTNAME" "127.0.0.1"
      if ($current -eq "0.0.0.0") {
        Write-EnvVal "HOSTNAME" "127.0.0.1"
        netsh advfirewall firewall delete rule name="$FirewallRule" 2>$null | Out-Null
        Write-Host "Office-LAN access is OFF - this computer only." -ForegroundColor Green
      } else {
        Write-Host "This lets OTHER computers in your office open CAP Trellis over the network." -ForegroundColor Yellow
        Write-Host "Only do this on a trusted office network (traffic is plain HTTP on the LAN)."
        $ok = Read-Host "Turn LAN access ON? (y/n)"
        if ($ok -eq "y") {
          Write-EnvVal "HOSTNAME" "0.0.0.0"
          netsh advfirewall firewall delete rule name="$FirewallRule" 2>$null | Out-Null
          netsh advfirewall firewall add rule name="$FirewallRule" dir=in action=allow protocol=TCP localport=$(Get-Port) | Out-Null
          Write-Host "Office-LAN access is ON." -ForegroundColor Green
        }
      }
      Stop-Server; Start-Sleep 1; Start-Server; Start-Sleep 3
    }
    "6" { Start-Process "http://localhost:$(Get-Port)" }
    "7" { if (Test-Path "data\server.log") { Get-Content "data\server.log" -Tail 25 } else { Write-Host "No log yet." } }
    "q" { break }
  }
  if ($choice -eq "q") { break }
}
