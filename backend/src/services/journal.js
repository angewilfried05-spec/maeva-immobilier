// Journal d'audit : chaque action sensible (argent, comptes, sauvegardes) est
// enregistrée avec l'auteur, l'heure et les détails. Jamais de données sensibles
// (mots de passe, jetons) dans les détails.
const pool = require('../config/db');

// client : connexion transactionnelle optionnelle (pool par défaut)
async function journal(client, req, action, entite, entiteId, details = null) {
  const q = client || pool;
  await q.query(
    `INSERT INTO journal_audit (utilisateur_id, action, entite, entite_id, details, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.utilisateur?.id ?? null, action, entite, entiteId ?? null,
     details ? JSON.stringify(details) : null, req.ip || null]
  );
}

module.exports = { journal };
