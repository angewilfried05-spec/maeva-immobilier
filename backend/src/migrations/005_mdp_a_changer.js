// ============================================================
//  MAEVA IMMOBILIER — Changement de mot de passe obligatoire
//  Les comptes qui utilisent encore un mot de passe par défaut (présent dans le code
//  source) doivent le changer à la prochaine connexion avant toute autre action.
// ============================================================
const bcrypt = require('bcryptjs');

const MOTS_DE_PASSE_PAR_DEFAUT = ['Carla2008', 'maeva2026'];

async function up(client) {
  await client.query('ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS doit_changer_mdp BOOLEAN NOT NULL DEFAULT FALSE');
  const { rows } = await client.query('SELECT id, password_hash FROM utilisateurs');
  for (const u of rows) {
    for (const mdp of MOTS_DE_PASSE_PAR_DEFAUT) {
      if (await bcrypt.compare(mdp, u.password_hash)) {
        await client.query('UPDATE utilisateurs SET doit_changer_mdp = TRUE WHERE id = $1', [u.id]);
        break;
      }
    }
  }
}

module.exports = { up, MOTS_DE_PASSE_PAR_DEFAUT };
