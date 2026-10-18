const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Fail fast : pas de secret par défaut faible. Le .env embarqué doit toujours
// définir JWT_SECRET, sinon le backend refuse de démarrer.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET manquant : définissez-le dans backend/.env');
}
const EXPIRES_H = Number(process.env.JWT_EXPIRES_H) || 24;

function signToken(utilisateur) {
  return jwt.sign(
    { id: utilisateur.id, username: utilisateur.username, role: utilisateur.role, nom: utilisateur.nom_complet,
      mdp_a_changer: Boolean(utilisateur.doit_changer_mdp) },
    SECRET,
    { expiresIn: `${EXPIRES_H}h` }
  );
}

// Vérifie le JWT et charge l'utilisateur dans req.utilisateur
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentification requise' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.utilisateur = payload;
    // Mot de passe par défaut / fixé par l'admin : seul le changement de mot de passe est autorisé
    if (payload.mdp_a_changer && !req.originalUrl.startsWith('/api/auth/')) {
      return res.status(403).json({ message: 'Vous devez changer votre mot de passe', code: 'MDP_A_CHANGER' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Session expirée ou invalide' });
  }
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
