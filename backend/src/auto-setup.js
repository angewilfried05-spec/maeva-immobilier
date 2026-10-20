// Setup automatique au premier lancement : crée la base si elle n'existe pas,
// applique les migrations et le seed. Conçu pour être appelé par Electron
// avant le démarrage du serveur Express. Silencieux si déjà en place.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'maeva_immobilier',
};

const crypto = require('crypto');

// Mot de passe initial : ADMIN_PASSWORD si fourni, sinon généré et affiché une fois.
const ADMIN_DEFAULT = {
  username: process.env.ADMIN_USERNAME || 'tahbiarmand',
  password: process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url'),
  genere: !process.env.ADMIN_PASSWORD,
  nom_complet: 'Tah Bi Armand',
};

// Comptes supplémentaires éventuels : SEED_USERS='user:mdp:Nom:role,user2:mdp2:...'
const UTILISATEURS_SUPP = String(process.env.SEED_USERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [username, password, nom_complet, role] = s.split(':');
    return { username, password, nom_complet: nom_complet || username, role: role || 'gerant' };
  });

async function setup() {
  // 1. Créer la base si elle n'existe pas (connexion au serveur via 'postgres')
  const adminPool = new Pool({ ...cfg, database: 'postgres' });
  try {
    const { rows } = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database]
    );
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${cfg.database}"`);
      console.log(`[auto-setup] Base "${cfg.database}" créée`);
    }
  } finally {
    await adminPool.end();
  }

  // 2. Appliquer les migrations
  const pool = new Pool(cfg);
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nom VARCHAR(255) PRIMARY KEY,
        applique_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const fichiers = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') || f.endsWith('.js')).sort();
      const { rows: faites } = await client.query('SELECT nom FROM schema_migrations');
      const aFaire = fichiers.filter((f) => !faites.some((r) => r.nom === f));
      // Base existante avec des données : sauvegarde de sécurité avant de la faire évoluer
      const { rows: existe } = await client.query("SELECT to_regclass('utilisateurs') IS NOT NULL AS ok");
      if (aFaire.length && existe[0].ok) {
        const s = await require('./services/sauvegarde').creerSauvegarde('avant-migration');
        console.log(`[auto-setup] Sauvegarde avant migration : ${s.nom}`);
      }
      for (const f of aFaire) {
        // Chaque migration est atomique : en cas d'échec, la base reste dans son état précédent
        await client.query('BEGIN');
        try {
          if (f.endsWith('.sql')) await client.query(fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
          else await require(path.join(migrationsDir, f)).up(client);
          await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [f]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${f} : ${e.message}`);
        }
        console.log(`[auto-setup] Migration ${f} appliquée`);
      }
    }

    // 3. Seed : admin par défaut + utilisateurs supplémentaires + config
    const { rows: adminRows } = await client.query(
      'SELECT id FROM utilisateurs WHERE lower(username) = lower($1)', [ADMIN_DEFAULT.username]
    );
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_DEFAULT.password, 10);
      await client.query(
        `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif, doit_changer_mdp)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE)`,
        [ADMIN_DEFAULT.username, hash, ADMIN_DEFAULT.nom_complet]
      );
      if (ADMIN_DEFAULT.genere) {
        console.log(`[auto-setup] Utilisateur admin créé — mot de passe initial : ${ADMIN_DEFAULT.password}`);
      } else {
        console.log('[auto-setup] Utilisateur admin créé');
      }
    }

    // Utilisateurs supplémentaires
    for (const u of UTILISATEURS_SUPP) {
      const { rows } = await client.query(
        'SELECT id FROM utilisateurs WHERE lower(username) = lower($1)', [u.username]
      );
      if (rows.length === 0) {
        const hash = await bcrypt.hash(u.password, 10);
        await client.query(
          `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif, doit_changer_mdp)
           VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
          [u.username, hash, u.nom_complet, u.role]
        );
        console.log(`[auto-setup] Utilisateur ${u.username} (${u.role}) créé`);
      }
    }

    const configs = [
      ['nom_societe', 'MAEVA  IMMOBILIER'],
      ['activite', 'Location & vente de bâtiment, Construction bâtiment, Travaux publique et Génie civil'],
      ['site', 'ANGRE'],
    ];
    for (const [cle, valeur] of configs) {
      await client.query(
        'INSERT INTO config (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO NOTHING',
        [cle, valeur]
      );
    }
    console.log('[auto-setup] Terminé avec succès');
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { setup };
