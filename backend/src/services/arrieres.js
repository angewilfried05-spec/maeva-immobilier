const pool = require('../config/db');

// Nombre de mois de retard d'un locataire à une date donnée.
// = mois attendus depuis le début du suivi - mois payés + arriérés initiaux.
async function calculerArrieres(locataireId, uptoMois) {
  const { rows } = await pool.query('SELECT * FROM locataires WHERE id = $1', [locataireId]);
  const loc = rows[0];
  if (!loc || loc.statut !== 'Actif') return 0;

  // Début du suivi : date d'entrée, sinon premier paiement, sinon 0
  let debut = loc.date_entree ? String(loc.date_entree).slice(0, 7) : null;
  if (!debut) {
    const p = await pool.query('SELECT MIN(mois) AS m FROM paiements WHERE locataire_id = $1', [locataireId]);
    debut = p.rows[0].m;
  }
  if (!debut) return Number(loc.arrieres_initial) || 0;

  const attendus = monthsBetween(debut, uptoMois) + 1;
  const payesR = await pool.query(
    'SELECT COALESCE(SUM(quantite_mois_payee),0) AS s FROM paiements WHERE locataire_id = $1 AND mois <= $2',
    [locataireId, uptoMois]
  );
  const payes = Number(payesR.rows[0].s);
  return Math.max(0, attendus - payes + (Number(loc.arrieres_initial) || 0));
}

function monthsBetween(m1, m2) {
  const [y1, mo1] = String(m1).split('-').map(Number);
  const [y2, mo2] = String(m2).split('-').map(Number);
  return (y2 - y1) * 12 + (mo2 - mo1);
}

module.exports = { calculerArrieres, monthsBetween };
