# MAEVA IMMOBILIER — Notes pour les agents

Application de bureau locale : Electron + React 18 (Vite) + Express embarqué (port 4001) + PostgreSQL.

## Commandes

```bash
npm run dev            # Vite (5173) + Electron, backend embarqué
npx vite build         # build frontend -> dist/
npm run dist           # build + installateur NSIS (release/)
cd backend && npm test # tests unitaires (node --test, backend/test/*.test.js)
```

Sous le shell bash de l'IDE, faire `unset ELECTRON_RUN_AS_NODE` avant de lancer Electron.
Le backend est chargé dans le process Electron : toute modification backend nécessite de relancer `npm run dev`.

## Modes d'exécution

- **local** : Electron lance le backend embarqué (`backend/.env`, PostgreSQL du PC).
- **distant** : Electron se connecte à un serveur (`MAEVA_SERVEUR`, ou `config.json` `{ "serveur": "https://…" }`
  dans le dossier userData ou dans `electron/`). Le backend local n'est pas chargé.
- **web** : le backend sert aussi `dist/` (`SERVIR_FRONTEND=1`), accès par navigateur.
- Les exports (Excel, Word, PDF) et les sauvegardes sont envoyés en téléchargement (`api.telecharger`), jamais écrits sur le disque du serveur.

## Serveur (Hetzner 62.238.52.27, maeva-immobilier.com)

- `bash deploy/deployer.sh` depuis le PC : déploie HEAD (le code doit être commité) dans `/opt/maeva/releases/<version>`,
  puis `/opt/maeva/current` → systemd `maeva` (`backend/src/production.js`), derrière Nginx, HTTPS par certbot.
- Premier déploiement ou `INSTALLER=1` : `deploy/installer-serveur.sh` (PostgreSQL, Node 22, Nginx, ufw, secrets).
- Secrets dans `/etc/maeva/maeva.env` (root, droits 600), générés sur le serveur, jamais dans Git. Modèle : `deploy/maeva.env.exemple`.
- Sauvegardes du serveur : `/var/lib/maeva/sauvegardes`. Restauration en ligne de commande : `node src/restaurer-cli.js <fichier.json>`.
- Ne jamais importer `backend/src/production.js` pour « tester le chargement » : il applique les migrations à la base configurée.

## Base de données

- Migrations dans `backend/src/migrations/` (`.sql` ou `.js` exportant `up(client)`), appliquées par `auto-setup.js`
  au démarrage, chacune dans une transaction, avec une sauvegarde `avant-migration_*.json` préalable.
- Tester sur une copie : `CREATE DATABASE maeva_copie TEMPLATE maeva_immobilier` (app arrêtée), puis lancer un
  backend sur 4002 avec `DB_NAME=maeva_copie MAEVA_DOSSIER_SAUVEGARDES=<dossier temporaire>`.
- Ne jamais tester sur la vraie base `maeva_immobilier`.

## Règles métier (compte locataire en FCFA)

- `versements` : plusieurs par mois, rattachés à un `mois` (mois de la liste de saisie, pas forcément la date réelle).
- `loyers_historique` : loyer applicable à partir d'un mois ; la dette passée garde l'ancien prix.
- Situation (`backend/src/services/situation.js`) : dû = `solde_initial` + loyers de `debut_suivi` à `mois_sortie`,
  moins versements ; affichée en FCFA + équivalent en mois, et « payé jusqu'à » pour les avances.
- Entrée : l'avance est un versement (type `avance`, compte dans les loyers perçus) ; la caution est à part.
- Départ (bouton dédié, pas par « Modifier ») : retenue sur caution = versement type `caution` ; remboursement
  éventuellement en dépense ; option de recréer la porte vide.
- Porte vide qui redevient occupée : nouveau compte à partir du mois d'entrée.
- L'ancienne table `paiements` est conservée mais n'est plus utilisée.
- **Unités** (`unites`) : la porte physique, propriétaire des contrats successifs ; chaque ligne
  `locataires` (= contrat d'occupation) pointe sur `unite_id`. Jamais deux contrats actifs sur
  la même unité. `services/unites.js` → `unitePour(client, batimentId, porte)` : trouve ou crée.
- **Clôture mensuelle** (`clotures`) : `POST /api/resumes/:mois/cloturer` (admin, gerant) fige
  le mois — toute écriture dessus (versement, dépense, note, remis, départ, import, révision de
  loyer, suppression liée) renvoie 409 `MOIS_CLOTURE`. `decloturer` = admin seul, journalisé.
  Garde centralisée : `services/cloture.js` → `refuserSiCloture(res, mois)` AVANT toute écriture
  (jamais de res.* dans une transaction). Un mois clôturé n'est jamais recalculé.
- **Relances** : `GET /api/relances?mois=` → débiteurs + liens `wa.me`/`sms:` pré-remplis.
- Scénario de bout en bout : `backend/scripts/scenario-p2.js` (nécessite un backend lancé sur 4002
  contre une copie ; `backend/scripts/reset-mdp-test.js` pose des mots de passe de test).

## API v1 (contrat pour les clients, dont Android/Kotlin)

- Toutes les routes sont montées sous `/api` (historique) **et** `/api/v1` (contrat stable).
- Spécification : `backend/src/openapi.json`, servie sur `/api/v1/openapi.json`.
- Auth : jeton d'accès court (`JWT_ACCES_MINUTES`, 60 par défaut) + `refresh_token` 30 j (`REFRESH_JOURS`)
  avec rotation ; rejouer un jeton révoqué révoque toute la famille (`services/tokens.js`).
- `POST /versements` accepte `cle_idempotence` (UNIQUE partielle) : rejouer renvoie l'existant (200).
- Chaque versement reçoit une quittance `Q-AAAA-NNNNNN` (`quittances` + `quittances_compteur`),
  PDF téléchargeable via `GET /versements/:id/quittance`.
- `journal_audit` : `journal(client, req, action, entite, id, details)` à appeler dans les écritures
  sensibles ; lecture `GET /api/v1/audit` réservée à l'admin.
- `jetons_refresh` est exclu des sauvegardes : une restauration révoque toutes les sessions.
- Frontend `api.js` : `setSession(res)` stocke la paire, refresh transparent sur 401, `deconnecter()`.
