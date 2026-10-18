#!/usr/bin/env bash
# Watchdog santé : redémarre le service si /api/health ne répond plus
# (systemd couvre les crashs ; ceci couvre le service vivant mais bloqué).
# Installée dans /etc/cron.d/maeva-surveillance — toutes les 5 minutes.
curl -fs --max-time 10 http://127.0.0.1:4001/api/health >/dev/null 2>&1 && exit 0
echo "[$(date -Is)] santé KO → redémarrage maeva" >> /var/log/maeva-surveillance.log
systemctl restart maeva
