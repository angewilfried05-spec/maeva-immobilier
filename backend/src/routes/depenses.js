const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');

const router = express.Router();

// GET /api/depenses?mois=
router.get('/', requireAuth, async (req, res) => {
  const { mois } = req.query;
  try {
    const params = [];
    let sql = 'SELECT * FROM depenses';
    if (mois) { sql += ' WHERE mois = $1'; params.push(mois); }
    sql += ' ORDER BY categorie, designation';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// Désignations déjà utilisées (pour la liste déroulante du frontend)
router.get('/designations', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT designation, categorie, beneficiaire,
              FIRST_VALUE(montant_unitaire) OVER (PARTITION BY designation ORDER BY id DESC) AS montant_unitaire,
              FIRST_VALUE(quantite) OVER (PARTITION BY designation ORDER BY id DESC) AS quantite
       FROM depenses ORDER BY designation`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/depenses  (admin, gerant, comptable)
router.post('/', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const { mois, designation, categorie, quantite, montant_unitaire, beneficiaire, note } = req.body || {};
  if (!mois || !designation) return res.status(400).json({ message: 'mois et designation requis' });
  const q = Number(quantite) || 0;
  const u = Number(montant_unitaire) || 0;
  try {
    const { rows } = await pool.query(
      `INSERT INTO depenses (mois, designation, categorie, quantite, montant_unitaire, montant_total, beneficiaire, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [mois, String(designation).trim().toUpperCase(), categorie || 'Autre', q, u, Math.round(q * u), beneficiaire || null, note || null]
    );
    await recalculerResume(mois);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/depenses/:id  (admin, gerant, comptable)
router.put('/:id', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const id = Number(req.params.id);
  const { mois, designation, categorie, quantite, montant_unitaire, beneficiaire, note } = req.body || {};
  const q = quantite !== undefined ? Number(quantite) || 0 : undefined;
  const u = montant_unitaire !== undefined ? Number(montant_unitaire) || 0 : undefined;
  const total = (q !== undefined && u !== undefined) ? Math.round(q * u) : undefined;
  try {
    const { rows } = await pool.query(
      `UPDATE depenses SET
         designation = COALESCE($1, designation),
         categorie = COALESCE($2, categorie),
         quantite = COALESCE($3, quantite),
         montant_unitaire = COALESCE($4, montant_unitaire),
         montant_total = COALESCE($5, montant_total),
         beneficiaire = COALESCE($6, beneficiaire),
         note = COALESCE($7, note),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [designation ? String(designation).trim().toUpperCase() : null, categorie || null,
       q === undefined ? null : q, u === undefined ? null : u, total === undefined ? null : total,
       beneficiaire || null, note || null, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dépense introuvable' });
    await recalculerResume(rows[0].mois);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/depenses/:id  (admin, gerant, comptable)
router.delete('/:id', requireAuth, requireRole('admin', 'gerant', 'comptable'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query('DELETE FROM depenses WHERE id = $1 RETURNING mois', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Dépense introuvable' });
    await recalculerResume(r.rows[0].mois);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
