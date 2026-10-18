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
