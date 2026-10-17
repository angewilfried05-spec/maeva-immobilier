const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/locataires?batiment_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { batiment_id } = req.query;
    const params = [];
    let sql = 'SELECT * FROM locataires';
    if (batiment_id) { sql += ' WHERE batiment_id = $1'; params.push(Number(batiment_id)); }
    sql += ' ORDER BY batiment_id, numero_porte NULLS LAST, nom_locataire';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/locataires/:id  (avec historique de paiements)
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query('SELECT * FROM locataires WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    const paiements = await pool.query(
      'SELECT * FROM paiements WHERE locataire_id = $1 ORDER BY mois DESC', [id]
    );
    res.json({ ...rows[0], paiements: paiements.rows });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/locataires  (admin, gerant)
router.post('/', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const { batiment_id, numero_porte, nom_locataire, loyer_mensuel, date_entree, statut, telephone, note, arrieres_initial } = req.body || {};
  if (!batiment_id || !nom_locataire) return res.status(400).json({ message: 'Bâtiment et nom requis' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO locataires (batiment_id, numero_porte, nom_locataire, loyer_mensuel, date_entree, statut, telephone, note, arrieres_initial)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [Number(batiment_id), numero_porte || null, String(nom_locataire).trim(),
       Number(loyer_mensuel) || 0, date_entree || null, statut || 'Actif',
       telephone || null, note || null, Number(arrieres_initial) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT /api/locataires/:id  (admin, gerant)
router.put('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  const { batiment_id, numero_porte, nom_locataire, loyer_mensuel, date_entree, statut, telephone, note, arrieres_initial } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE locataires SET
         batiment_id = COALESCE($1, batiment_id),
         numero_porte = COALESCE($2, numero_porte),
         nom_locataire = COALESCE($3, nom_locataire),
         loyer_mensuel = COALESCE($4, loyer_mensuel),
         date_entree = COALESCE($5, date_entree),
         statut = COALESCE($6, statut),
         telephone = COALESCE($7, telephone),
         note = COALESCE($8, note),
         arrieres_initial = COALESCE($9, arrieres_initial),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [batiment_id || null, numero_porte || null, nom_locataire || null,
       loyer_mensuel === undefined ? null : Number(loyer_mensuel),
       date_entree || null, statut || null, telephone || null, note || null,
       arrieres_initial === undefined ? null : Number(arrieres_initial), id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/locataires/:id  (admin, gerant)
router.delete('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query('DELETE FROM locataires WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Locataire introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
