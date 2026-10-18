const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { moisCloture } = require('../services/cloture');
const { journal } = require('../services/journal');
const { MOIS_VALIDE } = require('../services/loyers');

const router = express.Router();

// GET /api/resumes  (tous les mois ; les mois clôturés gardent leurs chiffres figés)
router.get('/', requireAuth, async (_req, res) => {
  try {
    const cloturees = (await pool.query('SELECT mois FROM clotures WHERE decloture_le IS NULL')).rows.map((r) => r.mois);
    const existants = await pool.query('SELECT mois FROM resumes');
    for (const r of existants.rows) {
      if (!cloturees.includes(r.mois)) await recalculerResume(r.mois);
    }
    const { rows } = await pool.query(
      `SELECT r.*, (c.mois IS NOT NULL) AS cloture, c.cloture_le, u.nom_complet AS cloture_par
       FROM resumes r
       LEFT JOIN clotures c ON c.mois = r.mois AND c.decloture_le IS NULL
       LEFT JOIN utilisateurs u ON u.id = c.cloture_par
       ORDER BY r.mois DESC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/resumes/:mois  (un mois clôturé garde ses chiffres figés : on lit, on ne recalcule pas)
router.get('/:mois', requireAuth, async (req, res) => {
  try {
    const cloture = await moisCloture(req.params.mois);
    const r = cloture
      ? (await pool.query('SELECT * FROM resumes WHERE mois = $1', [req.params.mois])).rows[0]
      : await recalculerResume(req.params.mois);
    if (!r) return res.status(404).json({ message: 'Mois inconnu' });
    res.json({ ...r, cloture });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/resumes/:mois/cloturer  (admin, gerant)
// Fige le mois : chiffres recalculés une dernière fois, puis plus aucune écriture.
router.post('/:mois/cloturer', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const mois = String(req.params.mois || '');
  if (!MOIS_VALIDE.test(mois)) return res.status(400).json({ message: 'Mois invalide' });
  try {
    if (await moisCloture(mois)) return res.status(409).json({ message: 'Ce mois est déjà clôturé', code: 'MOIS_CLOTURE' });
    const r = await recalculerResume(mois); // dernier calcul avant figement
    const remis = req.body?.remis_proprietaire !== undefined
      ? Number(req.body.remis_proprietaire)
      : r.montant_remis_au_proprietaire;
    await pool.query(
      'INSERT INTO clotures (mois, remis_proprietaire, cloture_par) VALUES ($1, $2, $3)',
      [mois, remis, req.utilisateur.id]
    );
    if (remis !== undefined && remis !== null) {
      await pool.query(
        'UPDATE resumes SET montant_remis_au_proprietaire = $1, updated_at = CURRENT_TIMESTAMP WHERE mois = $2',
        [remis, mois]
      );
    }
    await journal(null, req, 'mois.cloture', 'resume', null, { mois, remis });
    res.json({ ok: true, mois, cloture: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/resumes/:mois/decloturer  (admin seulement — rouvre les écritures du mois)
router.post('/:mois/decloturer', requireAuth, requireRole('admin'), async (req, res) => {
  const mois = String(req.params.mois || '');
  if (!MOIS_VALIDE.test(mois)) return res.status(400).json({ message: 'Mois invalide' });
  try {
    const r = await pool.query(
      'UPDATE clotures SET decloture_par = $1, decloture_le = CURRENT_TIMESTAMP WHERE mois = $2 AND decloture_le IS NULL',
      [req.utilisateur.id, mois]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: 'Ce mois n\'est pas clôturé' });
    await journal(null, req, 'mois.decloture', 'resume', null, { mois });
    res.json({ ok: true, mois, cloture: false });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/resumes/:mois/remis  (admin, gerant, comptable)
router.put('/:mois/remis', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const montant = Number(req.body?.montant) || 0;
  try {
    if (await moisCloture(req.params.mois)) {
      return res.status(409).json({ message: `Le mois ${req.params.mois} est clôturé`, code: 'MOIS_CLOTURE' });
    }
    const r = await recalculerResume(req.params.mois);
    const { rows } = await pool.query(
      'UPDATE resumes SET montant_remis_au_proprietaire = $1, updated_at = CURRENT_TIMESTAMP WHERE mois = $2 RETURNING *',
      [montant, req.params.mois]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
