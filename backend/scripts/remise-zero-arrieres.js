// Remise à zéro des arriérés : solde les dettes constatées à la fin d'un mois
// de référence en ajustant solde_initial, SANS créer de versements ni toucher
// aux avances. Usage : node scripts/remise-zero-arrieres.js 2026-09
const { chargerSituations } = require('../src/services/situation');
const pool = require('../src/config/db');

const moisRef = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(moisRef || '')) {
  console.error('Usage: node scripts/remise-zero-arrieres.js AAAA-MM');
  process.exit(1);
}

(async () => {
  const { locataires, situations } = await chargerSituations(moisRef);
  const aAjuster = locataires.filter((l) => l.statut === 'Actif' && situations[l.id].dette > 0);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const l of aAjuster) {
      const dette = situations[l.id].dette;
      await client.query(
        'UPDATE locataires SET solde_initial = solde_initial - $1, updated_at = now() WHERE id = $2',
        [dette, l.id]
      );
      console.log(`${l.nom_locataire} : dette ${dette} F soldée`);
    }
    await client.query(
      'INSERT INTO journal_audit (action, details, created_at) VALUES ($1, $2, now())',
      ['admin.remise_zero_arrieres',
       JSON.stringify({ mois_reference: moisRef, nb: aAjuster.length, via: 'ajustement_solde_initial' })]
    );
    await client.query('COMMIT');
    console.log(`Ajustés : ${aAjuster.length} contrat(s)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
