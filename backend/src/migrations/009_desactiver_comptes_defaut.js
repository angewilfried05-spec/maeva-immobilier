// ============================================================
//  MAEVA IMMOBILIER — Sécurité : désactivation des comptes encore
//  sur un mot de passe par défaut (diffusé dans le code source).
//  Un compte ainsi désactivé ne peut plus être piraté via le mot de
//  passe connu ; un admin peut le réactiver avec un nouveau mot de
//  passe depuis Utilisateurs.
// ============================================================
const bcrypt = require('bcryptjs');
const { MOTS_DE_PASSE_PAR_DEFAUT } = require('./005_mdp_a_changer');

async function up(client) {
  const { rows } = await client.query('SELECT id, username, password_hash, actif FROM utilisateurs WHERE actif = TRUE');
  for (const u of rows) {
    for (const mdp of MOTS_DE_PASSE_PAR_DEFAUT) {
      if (await bcrypt.compare(mdp, u.password_hash)) {
        await client.query(
          `UPDATE utilisateurs SET actif = FALSE, doit_changer_mdp = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [u.id]
        );
        console.log(`[migration 009] Compte "${u.username}" désactivé (mot de passe par défaut encore actif)`);
        break;
      }
    }
  }
}

module.exports = { up };
