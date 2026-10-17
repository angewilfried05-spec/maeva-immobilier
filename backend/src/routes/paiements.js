const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { calculerArrieres } = require('../services/arrieres');

const router = express.Router();

// GET /api/paiements?mois=
router.get('/', requireAuth, async (req, res) => {
  const { mois, locataire_id } = req.query;
  try {
    const params = [];
    const where = [];
    if (mois) { where.push('mois = $' + (params.length + 1)); params.push(mois); }
    if (locataire_id) { where.push('locataire_id = $' + (params.length + 1)); params.push(Number(locataire_id)); }
    let sql = 'SELECT * FROM paiements';
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY mois DESC, locataire_id';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/paiements  (upsert : une entrée par locataire et par mois)  (admin, gerant, comptable)
router.put('/', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const { locataire_id, mois, quantite_mois_payee, montant_unitaire, date_paiement, note } = req.body || {};
  if (!locataire_id || !mois) return res.status(400).json({ message: 'locataire_id et mois requis' });
  try {
    // Récupère le loyer du locataire si montant_unitaire non fourni
    let unit = montant_unitaire != null ? Number(montant_unitaire) : null;
    if (unit === null) {
      const r = await pool.query('SELECT loyer_mensuel FROM locataires WHERE id = $1', [Number(locataire_id)]);
      if (!r.rows[0]) return res.status(404).json({ message: 'Locataire introuvable' });
      unit = Number(r.rows[0].loyer_mensuel) || 0;
    }
    const qte = quantite_mois_payee !== undefined && quantite_mois_payee !== null
      ? Number(quantite_mois_payee) || 0
      : null;
    // Récupère la quantité existante si non fournie
    if (qte === null) {
      const ex = await pool.query('SELECT quantite_mois_payee FROM paiements WHERE locataire_id = $1 AND mois = $2', [Number(locataire_id), mois]);
      qte = ex.rows[0] ? Number(ex.rows[0].quantite_mois_payee) || 0 : 0;
    }
    const total = Math.round(qte * unit);
    const arrieres = await calculerArrieres(Number(locataire_id), mois);

    const { rows } = await pool.query(
      `INSERT INTO paiements (locataire_id, mois, quantite_mois_payee, montant_unitaire, montant_total_paye, date_paiement, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (locataire_id, mois) DO UPDATE SET
         quantite_mois_payee = EXCLUDED.quantite_mois_payee,
         montant_unitaire = EXCLUDED.montant_unitaire,
         montant_total_paye = EXCLUDED.montant_total_paye,
         date_paiement = COALESCE(EXCLUDED.date_paiement, paiements.date_paiement),
         note = COALESCE(EXCLUDED.note, paiements.note),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [Number(locataire_id), mois, qte, unit, total, date_paiement || null, note !== undefined ? note : null]
    );
    await recalculerResume(mois);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

module.exports = router;
