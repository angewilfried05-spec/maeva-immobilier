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

const ADMIN_DEFAULT = {
  username: 'tahbiarmand',
  password: 'Carla2008',
  nom_complet: 'Tah Bi Armand',
};

// Utilisateurs supplémentaires pré-créés (modifiables/supprimables ensuite dans l'app)
const UTILISATEURS_SUPP = [
  { username: 'gerant', password: 'maeva2026', nom_complet: 'Gérant', role: 'gerant' },
  { username: 'comptable', password: 'maeva2026', nom_complet: 'Comptable', role: 'comptable' },
];

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
      const fichiers = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of fichiers) {
        const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE nom = $1', [f]);
        if (rows.length > 0) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [f]);
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
        `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif)
         VALUES ($1, $2, $3, 'admin', TRUE)`,
        [ADMIN_DEFAULT.username, hash, ADMIN_DEFAULT.nom_complet]
      );
      console.log('[auto-setup] Utilisateur admin créé');
    }

    // Utilisateurs supplémentaires
    for (const u of UTILISATEURS_SUPP) {
      const { rows } = await client.query(
        'SELECT id FROM utilisateurs WHERE lower(username) = lower($1)', [u.username]
      );
      if (rows.length === 0) {
        const hash = await bcrypt.hash(u.password, 10);
        await client.query(
          `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif)
           VALUES ($1, $2, $3, $4, TRUE)`,
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
