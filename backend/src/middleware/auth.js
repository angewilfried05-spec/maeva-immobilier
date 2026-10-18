const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const pool = require('../config/db');

// Fail fast : pas de secret par défaut faible. Le .env embarqué doit toujours
// définir JWT_SECRET, sinon le backend refuse de démarrer.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET manquant : définissez-le dans backend/.env');
}
// Durée du jeton d'accès : courte (les clients rechargent via le refresh token).
// JWT_ACCES_MINUTES prioritaire ; JWT_EXPIRES_H accepté pour compatibilité.
const EXPIRES_MIN = Number(process.env.JWT_ACCES_MINUTES) || (Number(process.env.JWT_EXPIRES_H) || 1) * 60;

function signToken(utilisateur) {
  return jwt.sign(
    { id: utilisateur.id, username: utilisateur.username, role: utilisateur.role, nom: utilisateur.nom_complet,
      mdp_a_changer: Boolean(utilisateur.doit_changer_mdp) },
    SECRET,
    { expiresIn: `${EXPIRES_MIN}m` }
  );
}

// Vérifie le JWT et charge l'utilisateur dans req.utilisateur
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentification requise' });
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expirée ou invalide' });
  }
  req.utilisateur = payload;
  // Mot de passe par défaut / fixé par l'admin : seul le changement de mot de passe est autorisé
  // (routes auth sous /api et /api/v1 : login, refresh, change-password).
  // Le claim peut être périmé si un admin a levé le flag : on le revérifie en base.
  if (!payload.mdp_a_changer || /^\/api\/(v1\/)?auth\//.test(req.originalUrl)) return next();
  pool.query('SELECT doit_changer_mdp FROM utilisateurs WHERE id = $1 AND actif = TRUE', [payload.id])
    .then(({ rows }) => {
      if (rows[0] && rows[0].doit_changer_mdp) {
        return res.status(403).json({ message: 'Vous devez changer votre mot de passe', code: 'MDP_A_CHANGER' });
      }
      req.utilisateur.mdp_a_changer = false; // flag levé : la session continue
      next();
    })
    .catch(() => res.status(500).json({ message: 'Erreur serveur' }));
}

// Autorise uniquement certains rôles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.utilisateur) return res.status(401).json({ message: 'Authentification requise' });
    if (!roles.includes(req.utilisateur.role)) {
      return res.status(403).json({ message: 'Accès refusé : rôle insuffisant' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
