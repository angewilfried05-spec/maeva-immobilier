const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { fusionner, texteOuNull, majuscules } = require('../utils/fusion');
const { journal } = require('../services/journal');

const router = express.Router();

// GET /api/batiments
router.get('/', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM batiments ORDER BY id');
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/batiments  (admin, gerant)
router.post('/', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const { nom, adresse, note } = req.body || {};
  if (!nom || !nom.trim()) return res.status(400).json({ message: 'Le nom est requis' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO batiments (nom, adresse, note) VALUES ($1, $2, $3) RETURNING *',
      [String(nom).trim().toUpperCase(), adresse || null, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/batiments/:id  (admin, gerant)
router.put('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const ex = await pool.query('SELECT * FROM batiments WHERE id = $1', [id]);
    if (!ex.rows[0]) return res.status(404).json({ message: 'Bâtiment introuvable' });
    const v = fusionner(ex.rows[0], req.body || {}, { nom: majuscules, adresse: texteOuNull, note: texteOuNull });
    if (!v.nom) return res.status(400).json({ message: 'Le nom est requis' });
    const { rows } = await pool.query(
      'UPDATE batiments SET nom=$1, adresse=$2, note=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *',
      [v.nom, v.adresse, v.note, id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/batiments/:id  (admin, gerant)
// La suppression supprime en cascade unités, contrats et versements : impossible
// si le bâtiment a des écritures sur un mois clôturé.
router.delete('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const clot = await pool.query(
      `SELECT 1 FROM versements v
       JOIN locataires l ON l.id = v.locataire_id
       JOIN clotures c ON c.mois = v.mois AND c.decloture_le IS NULL
       WHERE l.batiment_id = $1 LIMIT 1`, [id]
    );
    if (clot.rows[0]) return res.status(409).json({ message: 'Ce bâtiment a des versements sur un mois clôturé', code: 'MOIS_CLOTURE' });
    const r = await pool.query('DELETE FROM batiments WHERE id = $1 RETURNING nom', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Bâtiment introuvable' });
    await journal(null, req, 'batiment.supprime', 'batiment', id, { nom: r.rows[0].nom });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
