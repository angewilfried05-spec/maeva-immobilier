const pool = require('../config/db');
const { chargerSituations } = require('./situation');

// Recalcule et upsert le résumé d'un mois donné.
//   attendu = loyers dus ce mois (au loyer en vigueur ce mois, locataires présents ce mois)
//   perçu   = versements rattachés à ce mois
async function recalculerResume(mois) {
  const { situations } = await chargerSituations(mois);
  const attendu = Object.values(situations).reduce((s, x) => s + x.loyer_du_mois, 0);
  const per = await pool.query('SELECT COALESCE(SUM(montant),0) AS s FROM versements WHERE mois = $1', [mois]);
  const dep = await pool.query('SELECT COALESCE(SUM(montant_total),0) AS s FROM depenses WHERE mois = $1', [mois]);
  const percu = Number(per.rows[0].s);
  const depenses = Number(dep.rows[0].s);
  const { rows } = await pool.query(
    `INSERT INTO resumes (mois, total_loyers_attendus, total_loyers_percus, total_depenses, solde, montant_remis_au_proprietaire)
     VALUES ($1,$2,$3,$4,$5,0)
     ON CONFLICT (mois) DO UPDATE SET
       total_loyers_attendus = EXCLUDED.total_loyers_attendus,
       total_loyers_percus = EXCLUDED.total_loyers_percus,
       total_depenses = EXCLUDED.total_depenses,
       solde = EXCLUDED.solde,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [mois, attendu, percu, depenses, percu - depenses]
  );
  return rows[0];
}

module.exports = { recalculerResume };
