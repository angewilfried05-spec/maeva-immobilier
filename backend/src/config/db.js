const { Pool, types } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Colonnes DATE renvoyées telles quelles ('AAAA-MM-JJ') plutôt qu'en objet Date :
// évite les décalages de fuseau et les String(date) inexploitables.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'maeva_immobilier',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('Erreur pool PostgreSQL:', err.message));

module.exports = pool;
