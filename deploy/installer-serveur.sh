#!/usr/bin/env bash
# Installation du serveur MAEVA IMMOBILIER (Ubuntu/Debian), à lancer en root.
# Idempotent : peut être relancé sans effet de bord (les secrets existants sont conservés).
set -euo pipefail

DOSSIER_DEPLOY="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE=/etc/maeva/maeva.env

echo "==> Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg postgresql nginx certbot python3-certbot-nginx ufw unattended-upgrades

echo "==> Node.js 22 LTS"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
node -v

echo "==> Utilisateur et dossiers"
id maeva >/dev/null 2>&1 || useradd --system --home /opt/maeva --shell /usr/sbin/nologin maeva
mkdir -p /opt/maeva/releases /var/lib/maeva/sauvegardes /etc/maeva
chown -R maeva:maeva /var/lib/maeva
chmod 750 /var/lib/maeva

echo "==> Secrets (/etc/maeva/maeva.env)"
if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 64)"
  sed -e "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" \
      -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" \
      "$DOSSIER_DEPLOY/maeva.env.exemple" | grep -v '^#' > "$ENV_FILE"
  echo "    créé"
else
  echo "    existant, conservé"
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"
DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

echo "==> PostgreSQL : rôle et base"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maeva') THEN
    CREATE ROLE maeva LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE maeva LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='maeva_immobilier'" | grep -q 1 \
  || sudo -u postgres createdb -O maeva maeva_immobilier

echo "==> Service systemd"
install -m 644 "$DOSSIER_DEPLOY/maeva.service" /etc/systemd/system/maeva.service
systemctl daemon-reload
systemctl enable maeva >/dev/null

echo "==> Nginx"
install -m 644 "$DOSSIER_DEPLOY/nginx-maeva.conf" /etc/nginx/sites-available/maeva
ln -sf /etc/nginx/sites-available/maeva /etc/nginx/sites-enabled/maeva
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Pare-feu (SSH, HTTP, HTTPS uniquement)"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

echo "==> Mises à jour de sécurité automatiques"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "✅ Serveur prêt. Étapes suivantes : deploy/deployer.sh (depuis le PC), puis HTTPS :"
echo "   certbot --nginx -d maeva-immobilier.com -d www.maeva-immobilier.com --redirect"
