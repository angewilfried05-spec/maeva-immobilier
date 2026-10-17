// Crée l'utilisateur admin par défaut + la config initiale.
// Usage : node src/seed.js
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin par défaut
    const { rows } = await client.query(
      "SELECT id FROM utilisateurs WHERE lower(username) = lower($1)", ['tahbiarmand']
    );
    if (rows.length === 0) {
      const hash = await bcrypt.hash('Carla2008', 10);
      await client.query(
        `INSERT INTO utilisateurs (username, password_hash, nom_complet, role, actif)
         VALUES ($1, $2, $3, 'admin', TRUE)`,
        ['tahbiarmand', hash, 'Tah Bi Armand']
      );
      console.log('✓ Utilisateur admin créé : tahbiarmand / Carla2008');
    } else {
      console.log('• Utilisateur admin déjà existant');
    }

    // Config initiale
    const configs = [
      ['nom_societe', 'MAEVA  IMMOBILIER'],
      ['activite', 'Location & vente de bâtiment, Construction bâtiment, Travaux publique et Génie civil'],
      ['site', 'ANGRE'],
    ];
    for (const [cle, valeur] of configs) {
      await client.query(
        `INSERT INTO config (cle, valeur) VALUES ($1, $2)
         ON CONFLICT (cle) DO NOTHING`, [cle, valeur]
      );
    }
    console.log('✓ Config initiale en place');

    await client.query('COMMIT');
    console.log('✅ Seed terminé');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Échec seed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
