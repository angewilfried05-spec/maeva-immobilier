const pool = require('../config/db');

// Exécute fn(client) dans une transaction (COMMIT si succès, ROLLBACK sinon).
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { transaction };
