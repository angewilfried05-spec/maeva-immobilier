const pool = require('../config/db');

// Recalcule et upsert le résumé d'un mois donné.
async function recalculerResume(mois) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Total loyers attendus = somme loyers mensuels des locataires actifs
    const att = await client.query("SELECT COALESCE(SUM(loyer_mensuel),0) AS s FROM locataires WHERE statut = 'Actif'");
    // Total perçu ce mois
    const per = await client.query('SELECT COALESCE(SUM(montant_total_paye),0) AS s FROM paiements WHERE mois = $1', [mois]);
    // Total dépenses ce mois
    const dep = await client.query('SELECT COALESCE(SUM(montant_total),0) AS s FROM depenses WHERE mois = $1', [mois]);
    const attendu = Number(att.rows[0].s);
    const percu = Number(per.rows[0].s);
    const depenses = Number(dep.rows[0].s);
    const solde = percu - depenses;
    const { rows } = await client.query(
      `INSERT INTO resumes (mois, total_loyers_attendus, total_loyers_percus, total_depenses, solde, montant_remis_au_proprietaire)
       VALUES ($1,$2,$3,$4,$5,0)
       ON CONFLICT (mois) DO UPDATE SET
         total_loyers_attendus = EXCLUDED.total_loyers_attendus,
         total_loyers_percus = EXCLUDED.total_loyers_percus,
         total_depenses = EXCLUDED.total_depenses,
         solde = EXCLUDED.solde,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [mois, attendu, percu, depenses, solde]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { recalculerResume };
