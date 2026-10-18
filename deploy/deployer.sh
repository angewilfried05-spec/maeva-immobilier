#!/usr/bin/env bash
# Déploie la version commitée (HEAD) sur le serveur. À lancer depuis le PC (Git Bash) à la racine du projet :
#   bash deploy/deployer.sh                 # mise à jour
#   INSTALLER=1 bash deploy/deployer.sh     # (re)lance aussi l'installation du serveur
# Chaque version est installée dans /opt/maeva/releases/<version> ; /opt/maeva/current pointe sur la version active.
# Retour arrière : ln -sfn /opt/maeva/releases/<ancienne> /opt/maeva/current && systemctl restart maeva
set -euo pipefail

SERVEUR="${SERVEUR:-root@62.238.52.27}"
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Des modifications ne sont pas commitées : seul le code commité est déployé." >&2
  exit 1
fi

VERSION="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
echo "==> Build du frontend ($VERSION)"
npx vite build >/dev/null

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive --format=tar HEAD -o "$TMP/maeva.tar"
tar -rf "$TMP/maeva.tar" dist
gzip "$TMP/maeva.tar"

echo "==> Envoi vers $SERVEUR"
scp -q "$TMP/maeva.tar.gz" "$SERVEUR:/tmp/maeva-$VERSION.tar.gz"

ssh "$SERVEUR" bash -s -- "$VERSION" "${INSTALLER:-0}" <<'DISTANT'
set -euo pipefail
V="$1"; R="/opt/maeva/releases/$V"
mkdir -p "$R"
tar -xzf "/tmp/maeva-$V.tar.gz" -C "$R"
rm -f "/tmp/maeva-$V.tar.gz"
if [ "$2" = "1" ] || [ ! -f /etc/systemd/system/maeva.service ]; then
  bash "$R/deploy/installer-serveur.sh"
fi
echo "==> Dépendances backend"
(cd "$R/backend" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
chown -R root:root "$R" && chmod -R a+rX "$R"
ln -sfn "$R" /opt/maeva/current
echo "==> Redémarrage"
systemctl restart maeva
for i in $(seq 1 30); do curl -fs http://127.0.0.1:4001/api/health >/dev/null && break; sleep 1; done
if ! curl -fs http://127.0.0.1:4001/api/health; then
  journalctl -u maeva -n 40 --no-pager
  exit 1
fi
echo
ls -1dt /opt/maeva/releases/* | tail -n +6 | xargs -r rm -rf   # conserve les 5 dernières versions
echo "✅ Version $V en ligne"
DISTANT
