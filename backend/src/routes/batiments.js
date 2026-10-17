const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');

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
  const { nom, adresse, note } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE batiments
       SET nom = COALESCE($1, nom), adresse = COALESCE($2, adresse), note = COALESCE($3, note),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [nom ? String(nom).trim().toUpperCase() : null, adresse || null, note || null, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Bâtiment introuvable' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/batiments/:id  (admin, gerant)
router.delete('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query('DELETE FROM batiments WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Bâtiment introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
