const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ROLES = ['admin', 'gerant', 'comptable', 'lecteur'];

// GET /api/utilisateurs  (admin seulement)
router.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, nom_complet, role, actif, last_login, created_at FROM utilisateurs ORDER BY id'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/utilisateurs  (admin)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { username, nom_complet, role, password } = req.body || {};
  if (!username || !nom_complet || !password) return res.status(400).json({ message: 'Champs manquants' });
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
  if (String(password).length < 8) return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  try {
    const hash = await bcrypt.hash(String(password), 10);
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username, nom_complet, role, actif`,
      [String(username).trim(), hash, String(nom_complet).trim(), role]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: "Ce nom d'utilisateur existe déjà" });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/utilisateurs/:id  (admin)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { nom_complet, role, actif, password } = req.body || {};
  if (role && !ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
  try {
    if (password) {
      if (String(password).length < 8) return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
      const hash = await bcrypt.hash(String(password), 10);
      await pool.query('UPDATE utilisateurs SET password_hash = $1 WHERE id = $2', [hash, id]);
    }
    const { rows } = await pool.query(
      `UPDATE utilisateurs
       SET nom_complet = COALESCE($1, nom_complet),
           role = COALESCE($2, role),
           actif = COALESCE($3, actif),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, nom_complet, role, actif`,
      [nom_complet || null, role || null, actif === undefined ? null : actif, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/utilisateurs/:id  (admin, ne peut pas se supprimer soi-même)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.utilisateur.id) return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
  try {
    const r = await pool.query('DELETE FROM utilisateurs WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
