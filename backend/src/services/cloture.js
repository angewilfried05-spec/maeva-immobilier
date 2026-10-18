// Clôture mensuelle : un mois clôturé est immuable — aucune écriture
// (versement, dépense, note, import) ne peut plus le modifier.
// L'admin peut déclôturer en cas d'erreur (l'action est tracée au journal).
const pool = require('../config/db');

async function moisCloture(mois, client) {
  const q = client || pool;
  const { rows } = await q.query(
    'SELECT 1 FROM clotures WHERE mois = $1 AND decloture_le IS NULL', [mois]
  );
  return rows.length > 0;
}

// Réponse 409 standardisée ; renvoie true si le mois est verrouillé.
async function refuserSiCloture(res, mois) {
  if (await moisCloture(mois)) {
    res.status(409).json({ message: `Le mois ${mois} est clôturé : écriture impossible`, code: 'MOIS_CLOTURE' });
    return true;
  }
  return false;
}

module.exports = { moisCloture, refuserSiCloture };
