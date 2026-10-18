const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();
(async () => {
  const c = new Client({ host: 'localhost', port: 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'maeva_test_p2' });
  await c.connect();
  for (const [u, p] of [['tahbiarmand', 'TestP2!2026'], ['comptable', 'TestCpt!2026'], ['gerant', 'TestGr!2026']]) {
    await c.query('UPDATE utilisateurs SET password_hash = $1, doit_changer_mdp = false WHERE username = $2', [await bcrypt.hash(p, 10), u]);
  }
  await c.end();
  console.log('reset OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
