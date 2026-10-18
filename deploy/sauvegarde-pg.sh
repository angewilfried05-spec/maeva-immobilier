#!/usr/bin/env bash
# Sauvegarde pg_dump quotidienne de la base de production.
# Installée par installer-serveur.sh dans /etc/cron.daily/maeva-pgdump.
# Rétention : 14 dumps journaliers + 12 dumps mensuels (1er du mois).
set -euo pipefail

# /var/lib/maeva est en 750 (propriété maeva) : l'utilisateur postgres ne peut
# pas l'atteindre. Les dumps binaires vivent donc dans /var/backups/maeva-pg.
DOSSIER=/var/backups/maeva-pg
BASE=maeva_immobilier
JOUR=$(date +%F)
MENSUEL=""; [ "$(date +%d)" = "01" ] && MENSUEL="-mensuel"

mkdir -p "$DOSSIER"
sudo -u postgres pg_dump -Fc "$BASE" -f "$DOSSIER/maeva_${JOUR}${MENSUEL}.dump"

# Rotation : on garde 14 dumps journaliers et tous les mensuels sauf > 12 mois
find "$DOSSIER" -name 'maeva_????-??-??.dump' -mtime +14 -delete
find "$DOSSIER" -name 'maeva_????-??-??-mensuel.dump' -mtime +365 -delete

echo "[$(date -Is)] sauvegarde pg OK"
