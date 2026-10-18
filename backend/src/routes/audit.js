const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/audit?entite=&entite_id=&depuis=&limite=  (admin seulement)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { entite, entite_id, utilisateur_id, depuis } = req.query;
  const limite = Math.min(Math.max(Number(req.query.limite) || 200, 1), 1000);
  try {
    const params = [];
    const where = [];
    if (entite) { params.push(String(entite)); where.push(`j.entite = $${params.length}`); }
    if (entite_id) { params.push(Number(entite_id)); where.push(`j.entite_id = $${params.length}`); }
    if (utilisateur_id) { params.push(Number(utilisateur_id)); where.push(`j.utilisateur_id = $${params.length}`); }
    if (depuis) { params.push(String(depuis)); where.push(`j.created_at >= $${params.length}`); }
    params.push(limite);
    const { rows } = await pool.query(
      `SELECT j.id, j.action, j.entite, j.entite_id, j.details, j.ip, j.created_at,
              u.username, u.nom_complet
       FROM journal_audit j LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY j.id DESC LIMIT $${params.length}`, params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
