const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function normaliserCategorie(c) {
  if (!c) return 'Matériaux';
  const cNorm = String(c).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[''']/g, "'");
  if (cNorm === 'main d oeuvre' || cNorm === "main d'oeuvre" || cNorm === 'main doeuvre') return "Main d'œuvre";
  return 'Matériaux';
}

// GET /api/catalogue?categorie=
router.get('/', requireAuth, async (req, res) => {
  const { categorie } = req.query;
  try {
    const params = [];
    let sql = 'SELECT * FROM catalogue_articles';
    if (categorie) { sql += ' WHERE categorie = $1'; params.push(categorie); }
    sql += ' ORDER BY categorie, designation';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/catalogue/designations-existantes
// Renvoie toutes les désignations déjà utilisées (dépenses + catalogue) pour pré-remplir la liste déroulante
router.get('/designations-existantes', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT upper(designation) AS designation
      FROM (
        SELECT designation FROM depenses
        UNION
        SELECT designation FROM catalogue_articles
        UNION
        SELECT designation FROM lignes_devis
      ) AS toutes
      WHERE designation IS NOT NULL AND designation <> ''
      ORDER BY designation
    `);
    res.json(rows.map((r) => r.designation));
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/catalogue  (admin, gerant)
router.post('/', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const { designation, categorie, unite, prix_unitaire_reference } = req.body || {};
  if (!designation) return res.status(400).json({ message: 'designation requise' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO catalogue_articles (designation, categorie, unite, prix_unitaire_reference)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [String(designation).trim().toUpperCase(),
       normaliserCategorie(categorie),
       (unite || 'forfait'),
       Number(prix_unitaire_reference) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/catalogue/:id  (admin, gerant)
router.put('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  const { designation, categorie, unite, prix_unitaire_reference } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE catalogue_articles SET
         designation = COALESCE($1, designation),
         categorie = COALESCE($2, categorie),
         unite = COALESCE($3, unite),
         prix_unitaire_reference = COALESCE($4, prix_unitaire_reference),
         date_maj = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [designation ? String(designation).trim().toUpperCase() : null,
       categorie ? normaliserCategorie(categorie) : null, unite || null,
       prix_unitaire_reference !== undefined ? Number(prix_unitaire_reference) || 0 : null, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Article introuvable' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/catalogue/:id  (admin, gerant)
router.delete('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query('DELETE FROM catalogue_articles WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Article introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
