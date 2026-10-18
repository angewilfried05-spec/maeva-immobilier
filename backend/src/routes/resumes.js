const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');

const router = express.Router();

// GET /api/resumes  (tous les mois, recalculés pour refléter les dernières saisies)
router.get('/', requireAuth, async (_req, res) => {
  try {
    const existants = await pool.query('SELECT mois FROM resumes');
    for (const r of existants.rows) await recalculerResume(r.mois);
    const { rows } = await pool.query('SELECT * FROM resumes ORDER BY mois DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/resumes/:mois
router.get('/:mois', requireAuth, async (req, res) => {
  try {
    const r = await recalculerResume(req.params.mois);
    res.json(r);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/resumes/:mois/remis  (admin, gerant, comptable)
router.put('/:mois/remis', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const montant = Number(req.body?.montant) || 0;
  try {
    const r = await recalculerResume(req.params.mois);
    const { rows } = await pool.query(
      'UPDATE resumes SET montant_remis_au_proprietaire = $1, updated_at = CURRENT_TIMESTAMP WHERE mois = $2 RETURNING *',
      [montant, req.params.mois]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
