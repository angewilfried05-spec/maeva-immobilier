const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { chargerSituations, moisCourant } = require('../services/situation');

const router = express.Router();

// GET /api/dashboard?mois=AAAA-MM
router.get('/', requireAuth, async (req, res) => {
  const mois = req.query.mois || moisCourant();
  try {
    const moisClot = (await pool.query(
      'SELECT 1 FROM clotures WHERE mois = $1 AND decloture_le IS NULL', [mois]
    ).catch(() => ({ rows: [] }))).rows.length > 0;
    const resume = moisClot
      ? (await pool.query('SELECT * FROM resumes WHERE mois = $1', [mois])).rows[0] || null
      : await recalculerResume(mois);
    const { locataires, situations } = await chargerSituations(mois);
    const batiments = await pool.query('SELECT * FROM batiments ORDER BY id');
    const versements = await pool.query('SELECT * FROM versements WHERE mois = $1 ORDER BY date_versement, id', [mois]);
    const depenses = await pool.query('SELECT * FROM depenses WHERE mois = $1', [mois]);
    const notesRows = await pool.query('SELECT locataire_id, note FROM notes_loyers WHERE mois = $1', [mois]);
    const notes = {};
    notesRows.rows.forEach((n) => { notes[n.locataire_id] = n.note; });

    const parBatiment = batiments.rows.map((b) => {
      const locs = locataires.filter((l) => l.batiment_id === b.id);
      const ids = new Set(locs.map((l) => l.id));
      return {
        ...b,
        attendu: locs.reduce((s, l) => s + situations[l.id].loyer_du_mois, 0),
        percu: versements.rows.filter((v) => ids.has(v.locataire_id)).reduce((s, v) => s + v.montant, 0),
        nb: locs.filter((l) => situations[l.id].loyer_du_mois > 0).length,
      };
    });

    const enRetard = locataires
      .filter((l) => situations[l.id].dette > 0 && situations[l.id].loyer_du_mois > 0)
      .map((l) => ({ ...l, situation: situations[l.id] }))
      .sort((a, b) => b.situation.dette - a.situation.dette);

    const { rows: vp } = await pool.query(
      `SELECT count(*)::int AS libres FROM unites u
       WHERE NOT EXISTS (SELECT 1 FROM locataires l WHERE l.unite_id = u.id AND l.statut = 'Actif')`
    ).catch(() => ({ rows: [{ libres: 0 }] }));

    res.json({
      mois,
      batiments: batiments.rows,
      locataires,
      situations,
      versements: versements.rows,
      notes,
      depenses: depenses.rows,
      resume,
      par_batiment: parBatiment,
      en_retard: enRetard,
      cautions_detenues: locataires.filter((l) => l.statut !== 'Parti').reduce((s, l) => s + (l.caution || 0), 0),
      alertes: {
        mois_cloture: moisClot,
        portes_libres: vp[0].libres,
        en_retard: enRetard.length,
        dette_totale: enRetard.reduce((s, l) => s + l.situation.dette, 0),
      },
    });
  } catch (e) {
    console.error('dashboard:', e.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
