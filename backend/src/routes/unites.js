const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { texteOuNull, entier } = require('../utils/fusion');
const { journal } = require('../services/journal');

const router = express.Router();
const GESTION = requireRole('admin', 'gerant');

// GET /api/v1/unites?batiment_id=&statut=  — portes physiques et leur occupation
//   statut calcule : 'occupee' (contrat actif) ou 'libre'
router.get('/', requireAuth, async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.query.batiment_id) { params.push(Number(req.query.batiment_id)); where = `WHERE u.batiment_id = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT u.id, u.batiment_id, u.porte, u.loyer_base, b.nom AS batiment,
              c.id AS contrat_id, c.nom_locataire, c.statut AS statut_contrat,
              CASE WHEN c.id IS NOT NULL THEN 'occupee' ELSE 'libre' END AS statut
       FROM unites u
       JOIN batiments b ON b.id = u.batiment_id
       LEFT JOIN locataires c ON c.unite_id = u.id AND c.statut = 'Actif'
       ${where}
       ORDER BY b.nom, u.porte NULLS LAST`,
      params
    );
    const statut = req.query.statut;
    res.json(statut ? rows.filter((u) => u.statut === statut) : rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/v1/unites/:id  — porte + historique de toutes ses occupations
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const u = (await pool.query(
      'SELECT u.*, b.nom AS batiment FROM unites u JOIN batiments b ON b.id = u.batiment_id WHERE u.id = $1', [id]
    )).rows[0];
    if (!u) return res.status(404).json({ message: 'Unité introuvable' });
    const occupations = await pool.query(
      `SELECT id, nom_locataire, telephone, loyer_mensuel, date_entree, statut,
              debut_suivi, mois_sortie, caution, solde_initial
       FROM locataires WHERE unite_id = $1 AND statut <> 'Vide'
       ORDER BY debut_suivi DESC NULLS LAST, id DESC`, [id]
    );
    res.json({ ...u, occupations: occupations.rows });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/v1/unites  (admin, gerant) — déclarer une porte
router.post('/', requireAuth, GESTION, async (req, res) => {
  const { batiment_id, porte, loyer_base } = req.body || {};
  if (!batiment_id) return res.status(400).json({ message: 'Bâtiment requis' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO unites (batiment_id, porte, loyer_base) VALUES ($1, $2, $3) RETURNING *',
      [Number(batiment_id), texteOuNull(porte), entier(loyer_base)]
    );
    await journal(null, req, 'unite.cree', 'unite', rows[0].id, { porte: rows[0].porte, batiment_id });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Cette porte existe déjà dans ce bâtiment' });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/v1/unites/:id  (admin, gerant) — porte / loyer de base
router.put('/:id', requireAuth, GESTION, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const ex = (await pool.query('SELECT * FROM unites WHERE id = $1', [id])).rows[0];
    if (!ex) return res.status(404).json({ message: 'Unité introuvable' });
    const porte = req.body.porte !== undefined ? texteOuNull(req.body.porte) : ex.porte;
    const loyer = req.body.loyer_base !== undefined ? entier(req.body.loyer_base) : ex.loyer_base;
    const { rows } = await pool.query(
      'UPDATE unites SET porte = $1, loyer_base = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [porte, loyer, id]
    );
    await journal(null, req, 'unite.modifie', 'unite', id, { porte, loyer_base: loyer });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Cette porte existe déjà dans ce bâtiment' });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/v1/unites/:id  (admin) — seulement si jamais occupée
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const nb = await pool.query(
      "SELECT count(*)::int n FROM locataires WHERE unite_id = $1 AND statut <> 'Vide'", [id]
    );
    if (nb.rows[0].n > 0) return res.status(409).json({ message: 'Unité avec historique : suppression impossible' });
    const r = await pool.query('DELETE FROM unites WHERE id = $1 RETURNING porte', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Unité introuvable' });
    await journal(null, req, 'unite.supprime', 'unite', id, { porte: r.rows[0].porte });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
