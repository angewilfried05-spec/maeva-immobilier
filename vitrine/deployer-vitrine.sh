#!/usr/bin/env bash
# ============================================================
# MAEVA IMMOBILIER — Déploiement de la vitrine statique
# Envoie le contenu de site/ vers /var/www/maeva-vitrine sur le VPS.
# Usage : bash vitrine/deployer-vitrine.sh
# ============================================================
set -euo pipefail

# ---- Réglages ----
SERVEUR="root@62.238.52.27"
DEST="/var/www/maeva-vitrine"
SOURCE="$(cd "$(dirname "$0")" && pwd)/site/"

echo "==> Envoi de ${SOURCE} vers ${SERVEUR}:${DEST}"

# Le dossier doit exister et être accessible en écriture par root
ssh "$SERVEUR" "mkdir -p '$DEST'"

if command -v rsync >/dev/null 2>&1; then
  rsync -avz --delete "$SOURCE" "$SERVEUR:$DEST/"
else
  # Repli scp : on envoie une archive pour préserver la structure
  ARCHIVE="$(mktemp -u)/vitrine.tar.gz"
  mkdir -p "$(dirname "$ARCHIVE")"
  tar -czf "$ARCHIVE" -C "$(dirname "$SOURCE")" "$(basename "$SOURCE")"
  scp "$ARCHIVE" "$SERVEUR:/tmp/vitrine.tar.gz"
  ssh "$SERVEUR" "rm -rf '$DEST'/site && tar -xzf /tmp/vitrine.tar.gz -C '$DEST' --strip-components=1 && rm /tmp/vitrine.tar.gz"
  rm -f "$ARCHIVE"
fi

echo "==> Vérification"
ssh "$SERVEUR" "ls -la '$DEST' && test -f '$DEST/index.html' && echo 'OK : index.html en place'"

echo "✅ Vitrine déployée dans $DEST"
