const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const tentatives = new Map();

function cleTentative(req, username) {
  return `${req.ip}::${String(username || '').toLowerCase()}`;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ message: 'Identifiants invalides' });

  const cle = cleTentative(req, username);
  const etat = tentatives.get(cle);
  if (etat && etat.blocqueJusque > Date.now()) {
    return res.status(429).json({ message: 'Trop de tentatives. Réessayez plus tard.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash, nom_complet, role, actif FROM utilisateurs WHERE lower(username) = lower($1)',
      [username]
    );
    const u = rows[0];
    const ok = u && u.actif && await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      const count = (etat?.count || 0) + 1;
      tentatives.set(cle, { count, blocqueJusque: count >= LOGIN_MAX_ATTEMPTS ? Date.now() + LOGIN_BLOCK_MS : 0 });
      return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
    }
    tentatives.delete(cle);
    await pool.query('UPDATE utilisateurs SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [u.id]);
    const token = signToken(u);
    res.json({ token, utilisateur: { id: u.id, username: u.username, nom_complet: u.nom_complet, role: u.role } });
  } catch (e) {
    console.error('login:', e.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, nom_complet, role, actif, last_login FROM utilisateurs WHERE id = $1',
      [req.utilisateur.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const ancien = String(req.body?.ancien || '');
  const nouveau = String(req.body?.nouveau || '');
  if (nouveau.length < 8) return res.status(400).json({ message: 'Le nouveau mot de passe doit faire au moins 8 caractères' });
  try {
    const { rows } = await pool.query('SELECT password_hash FROM utilisateurs WHERE id = $1', [req.utilisateur.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' });
    const ok = await bcrypt.compare(ancien, rows[0].password_hash);
    if (!ok) return res.status(400).json({ message: 'Ancien mot de passe incorrect' });
    const hash = await bcrypt.hash(nouveau, 10);
    await pool.query('UPDATE utilisateurs SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, req.utilisateur.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
