# Deploy the CSBG intake app to the staging server (host alias "dev" = dchevalier@YOUR_SERVER_IP).
# Requires deploy/provision.sh to have been run once on the server.
# Packs the source (no node_modules/.next/data/.git), ships it over scp, builds on the
# server as dchevalier, and restarts the systemd service (passwordless via the sudoers
# rule provisioning installed). Usage:  .\deploy\deploy.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$tarball = Join-Path $env:TEMP "csbg-intake-$stamp.tgz"

Write-Host ">> Packing source ..."
# Windows tar (libarchive) ignores ./ anchoring and matches --exclude against the
# basename component, so a bare "data" would also strip src/lib/data and app/(app)/data.
# Exclude the runtime store by unique basenames/extensions that can't collide with
# source dirs (uploads, backups, *.db*); the now-empty top-level data/ ships harmlessly.
Push-Location $root
try {
    tar -czf $tarball `
        --exclude=./node_modules --exclude=./.next --exclude=./.git `
        --exclude=./.claude-snapshot --exclude=./design_handoff_doc_verification `
        --exclude=uploads --exclude=backups `
        --exclude=*.db --exclude=*.db-shm --exclude=*.db-wal `
        .
} finally { Pop-Location }

Write-Host ">> Verifying critical sources are in the archive ..."
# Trim each line: tar -tzf output carries a trailing CR that breaks exact comparison.
$listing = (tar -tzf $tarball) | ForEach-Object { $_.Trim() }
foreach ($must in @('./src/lib/data/core.ts', './src/db/ddl.ts', './app/(app)/eligibility/actions.ts')) {
    if ($listing -notcontains $must) {
        Remove-Item $tarball
        throw "Archive is missing $must — aborting before ship. Check the tar excludes."
    }
}

Write-Host ">> Shipping to server ..."
scp $tarball dev:/tmp/csbg-intake.tgz
Remove-Item $tarball

Write-Host ">> Extracting, building, restarting on server ..."
# /opt/csbg-intake is owned by dchevalier (set up by provision.sh), so extraction and
# build need no sudo; only the service restart uses the narrow NOPASSWD sudoers rule.
ssh dev @'
set -e
tar -xzf /tmp/csbg-intake.tgz -C /opt/csbg-intake
rm /tmp/csbg-intake.tgz
cd /opt/csbg-intake
npm ci --no-audit --no-fund
npm run build
sudo systemctl restart csbg-intake
sleep 2
sudo systemctl is-active csbg-intake
'@
Write-Host ">> Done. http://YOUR_SERVER_IP/"
