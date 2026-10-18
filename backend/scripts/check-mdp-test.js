const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ host: 'localhost', port: 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'maeva_test_p2' });
  await c.connect();
  const r = await c.query('SELECT password_hash, actif, doit_changer_mdp FROM utilisateurs WHERE username = $1', ['tahbiarmand']);
  console.log('row:', r.rows[0] ? { actif: r.rows[0].actif, mdp: r.rows[0].doit_changer_mdp } : 'absent');
  console.log('compare TestP2!2026:', await bcrypt.compare('TestP2!2026', r.rows[0].password_hash));
  await c.end();
})().catch((e) => console.error(e.message));
