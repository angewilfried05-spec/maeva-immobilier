const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { calculerArrieres } = require('../services/arrieres');

const router = express.Router();

// GET /api/dashboard?mois=AAAA-MM
router.get('/', requireAuth, async (req, res) => {
  const mois = req.query.mois || new Date().toISOString().slice(0, 7);
  try {
    await recalculerResume(mois);

    const batiments = await pool.query('SELECT * FROM batiments ORDER BY id');
    const locataires = await pool.query("SELECT * FROM locataires WHERE statut <> 'Parti' ORDER BY batiment_id, numero_porte NULLS LAST, nom_locataire");
    const paiements = await pool.query('SELECT * FROM paiements WHERE mois = $1', [mois]);
    const depenses = await pool.query('SELECT * FROM depenses WHERE mois = $1', [mois]);
    const resume = await pool.query('SELECT * FROM resumes WHERE mois = $1', [mois]);

    // Arriérés courants par locataire
    const arrieres = {};
    for (const l of locataires.rows) {
      arrieres[l.id] = await calculerArrieres(l.id, mois);
    }

    // Stats par bâtiment
    const parBatiment = batiments.rows.map((b) => {
      const locs = locataires.rows.filter((l) => l.batiment_id === b.id && l.statut === 'Actif');
      const attendu = locs.reduce((s, l) => s + Number(l.loyer_mensuel), 0);
      const percu = paiements.rows
        .filter((p) => locs.some((l) => l.id === p.locataire_id))
        .reduce((s, p) => s + Number(p.montant_total_paye), 0);
      return { ...b, attendu, percu, nb: locs.length };
    });

    const enRetard = locataires.rows
      .filter((l) => l.statut === 'Actif' && arrieres[l.id] > 0)
      .map((l) => ({ ...l, arrieres_mois: arrieres[l.id] }))
      .sort((a, b) => b.arrieres_mois - a.arrieres_mois);

    res.json({
      mois,
      batiments: batiments.rows,
      locataires: locataires.rows,
      paiements: paiements.rows,
      depenses: depenses.rows,
      resume: resume.rows[0] || null,
      par_batiment: parBatiment,
      arrieres_courants: arrieres,
      en_retard: enRetard,
    });
  } catch (e) {
    console.error('dashboard:', e.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
