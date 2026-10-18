// Sessions longue durée : jeton d'accès JWT (court) + jeton de rafraîchissement
// aléatoire (longue durée) avec rotation et détection de réutilisation.
// Le serveur ne stocke que le hash SHA-256 du jeton : une fuite de la base
// ne permet pas de rejouer des sessions.
const crypto = require('crypto');
const pool = require('../config/db');
const { transaction } = require('../utils/transaction');
const { signToken } = require('../middleware/auth');

const DUREE_REFRESH_JOURS = Number(process.env.REFRESH_JOURS) || 30;
const hache = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const erreur401 = (message) => Object.assign(new Error(message), { status: 401 });

function reponseSession(u, refresh, expire) {
  return {
    token: signToken(u),
    refresh_token: refresh,
    refresh_expire_le: expire.toISOString(),
    utilisateur: {
      id: u.id, username: u.username, nom_complet: u.nom_complet,
      role: u.role, doit_changer_mdp: Boolean(u.doit_changer_mdp),
    },
  };
}

// Connexion : nouvelle paire accès + refresh (nouvelle famille de rotation)
async function creerSession(u, req) {
  const refresh = crypto.randomBytes(48).toString('base64url');
  const expire = new Date(Date.now() + DUREE_REFRESH_JOURS * 86400000);
  await pool.query(
    `INSERT INTO jetons_refresh (utilisateur_id, hash, famille, expire_le, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [u.id, hache(refresh), crypto.randomUUID(), expire,
     String(req?.headers?.['user-agent'] || '').slice(0, 255), req?.ip || null]
  );
  return reponseSession(u, refresh, expire);
}

// Renouvellement : le jeton présenté est révoqué et remplacé (rotation).
// Rejouer un jeton déjà révoqué = possible vol → toute la famille est révoquée.
// La révocation de famille est commitée AVANT de renvoyer l'erreur : lever
// l'exception dans la transaction annulerait la révocation (ROLLBACK).
async function rotaterSession(refreshBrut, req) {
  if (!refreshBrut) throw erreur401('Jeton de rafraîchissement manquant');
  const j0 = (await pool.query('SELECT * FROM jetons_refresh WHERE hash = $1', [hache(refreshBrut)])).rows[0];
  if (!j0) throw erreur401('Session inconnue');
  if (j0.revoque_le) {
    await pool.query(
      'UPDATE jetons_refresh SET revoque_le = CURRENT_TIMESTAMP WHERE famille = $1 AND revoque_le IS NULL',
      [j0.famille]
    );
    throw erreur401('Session révoquée : reconnectez-vous');
  }
  if (new Date(j0.expire_le) <= new Date()) throw erreur401('Session expirée : reconnectez-vous');
  const resultat = await transaction(async (client) => {
    // Relecture sous verrou : une rotation concurrente aurait pu révoquer entre-temps
    const { rows } = await client.query(
      'SELECT * FROM jetons_refresh WHERE id = $1 FOR UPDATE', [j0.id]
    );
    const j = rows[0];
    if (!j || j.revoque_le || new Date(j.expire_le) <= new Date()) {
      if (j) {
        await client.query(
          'UPDATE jetons_refresh SET revoque_le = CURRENT_TIMESTAMP WHERE famille = $1 AND revoque_le IS NULL',
          [j.famille]
        );
      }
      return { rejete: true };
    }
    const u = (await client.query(
      'SELECT * FROM utilisateurs WHERE id = $1 AND actif', [j.utilisateur_id]
    )).rows[0];
    if (!u) throw erreur401('Compte inactif');
    const refresh = crypto.randomBytes(48).toString('base64url');
    const expire = new Date(Date.now() + DUREE_REFRESH_JOURS * 86400000);
    const { rows: ins } = await client.query(
      `INSERT INTO jetons_refresh (utilisateur_id, hash, famille, expire_le, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [u.id, hache(refresh), j.famille, expire,
       String(req?.headers?.['user-agent'] || '').slice(0, 255), req?.ip || null]
    );
    await client.query(
      'UPDATE jetons_refresh SET revoque_le = CURRENT_TIMESTAMP, remplace_par = $1 WHERE id = $2',
      [ins[0].id, j.id]
    );
    return reponseSession(u, refresh, expire);
  });
  if (resultat.rejete) throw erreur401('Session révoquée : reconnectez-vous');
  return resultat;
}

async function revoquerJeton(refreshBrut) {
  if (refreshBrut) {
    await pool.query(
      'UPDATE jetons_refresh SET revoque_le = CURRENT_TIMESTAMP WHERE hash = $1 AND revoque_le IS NULL',
      [hache(refreshBrut)]
    );
  }
}

// Déconnexion de tous les appareils (changement de mot de passe, compte désactivé…)
async function revoquerUtilisateur(utilisateurId) {
  await pool.query(
    'UPDATE jetons_refresh SET revoque_le = CURRENT_TIMESTAMP WHERE utilisateur_id = $1 AND revoque_le IS NULL',
    [utilisateurId]
  );
}

module.exports = { creerSession, rotaterSession, revoquerJeton, revoquerUtilisateur };
