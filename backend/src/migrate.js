// Crée la base maeva_immobilier si elle n'existe pas, puis applique les migrations SQL.
// Usage : node src/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres', // connexion au serveur pour créer la base
});

async function run() {
  const dbName = process.env.DB_NAME || 'maeva_immobilier';
  console.log('🔄 Migration de la base', dbName);

  // 1. Créer la base si elle n'existe pas
  const client = await adminPool.connect();
  try {
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1", [dbName]
    );
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`   ✓ Base "${dbName}" créée`);
    } else {
      console.log(`   • Base "${dbName}" déjà existante`);
    }
  } finally {
    client.release();
  }
  await adminPool.end();

  // 2. Appliquer les migrations sur la base cible
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });
  const migClient = await pool.connect();
  try {
    await migClient.query('BEGIN');
    await migClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nom VARCHAR(255) PRIMARY KEY,
        applique_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const migrationsDir = path.join(__dirname, 'migrations');
    const fichiers = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql')).sort();
    for (const f of fichiers) {
      const { rows } = await migClient.query(
        'SELECT 1 FROM schema_migrations WHERE nom = $1', [f]
      );
      if (rows.length > 0) { console.log(`   • ${f} déjà appliquée`); continue; }
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      await migClient.query(sql);
      await migClient.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [f]);
      console.log(`   ✓ ${f} appliquée`);
    }
    await migClient.query('COMMIT');
    console.log('✅ Migration terminée avec succès');
  } catch (e) {
    await migClient.query('ROLLBACK');
    console.error('❌ Échec migration:', e.message);
    process.exit(1);
  } finally {
    migClient.release();
    await pool.end();
  }
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
