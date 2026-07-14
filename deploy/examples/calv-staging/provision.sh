#!/usr/bin/env bash
# Provision the staging server (Ubuntu, shared box) for the CSBG Client
# Intake System staging deployment. NON-DESTRUCTIVE to any other apps on this
# host: adds a new Apache vhost, a new
# PostgreSQL database + role, and a systemd unit — touches nothing else.
# PostgreSQL stays localhost-only (no shared-instance restart).
# Idempotent — safe to re-run:  sudo bash provision.sh
set -euo pipefail
cd "$(dirname "$0")"

APP_DIR=/opt/csbg-intake
ENV_FILE=/etc/csbg-intake.env
DB_NAME=csbg_intake
DB_USER=csbg
SERVICE_USER=dchevalier   # the app runs as this existing user so deploys need no sudo

echo ">> Ensuring packages (apache2, postgresql, node) ..."
export DEBIAN_FRONTEND=noninteractive
apt-get install -y apache2 postgresql postgresql-client >/dev/null
# Node 20+ is already present on this box; only install if missing/older.
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo ">> App directory $APP_DIR (owned by $SERVICE_USER) ..."
mkdir -p "$APP_DIR" "$APP_DIR/data/backups" "$APP_DIR/data/uploads"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo ">> Environment file $ENV_FILE ..."
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
CSBG_ALLOW_HTTP=1
DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
EOF
  chgrp "$SERVICE_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
else
  DB_PASS=$(grep -oP 'postgres://[^:]+:\K[^@]+' "$ENV_FILE")
  echo "   (kept existing credentials)"
fi

echo ">> PostgreSQL role + database (localhost-only) ..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN"
sudo -u postgres psql -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
# No listen_addresses / pg_hba changes and no restart — the app connects via
# localhost, so the shared Postgres instance and its other databases are untouched.

echo ">> Apache reverse-proxy vhost (additive; other sites untouched) ..."
a2enmod proxy proxy_http headers >/dev/null
cp apache-csbg-intake.conf /etc/apache2/sites-available/csbg-intake.conf
a2ensite csbg-intake >/dev/null
apache2ctl configtest
systemctl reload apache2

echo ">> systemd unit (runs as $SERVICE_USER) ..."
cp csbg-intake.service /etc/systemd/system/csbg-intake.service
systemctl daemon-reload
systemctl enable csbg-intake >/dev/null

echo ">> Passwordless rule for service restarts only (so deploys need no password) ..."
cat > /etc/sudoers.d/csbg-intake <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart csbg-intake, /usr/bin/systemctl start csbg-intake, /usr/bin/systemctl stop csbg-intake, /usr/bin/systemctl status csbg-intake, /usr/bin/systemctl is-active csbg-intake
EOF
chmod 440 /etc/sudoers.d/csbg-intake
visudo -cf /etc/sudoers.d/csbg-intake

echo
echo "Provisioned. Next: deploy the app (no password needed) with deploy/deploy.ps1"
echo "from the workstation, which builds it and starts csbg-intake."
echo "App env (DATABASE_URL) is in $ENV_FILE — keep it secret."
