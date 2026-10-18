// versements.type accepte 'arriere' : paiement d'arriéré, rattaché au mois
// couvert (v.mois). Ex. encaissé en octobre pour la dette de septembre.
async function up(client) {
  const { rows } = await client.query(
    `SELECT DISTINCT c.conname FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
     WHERE t.relname = 'versements' AND c.contype = 'c' AND a.attname = 'type'`
  );
  for (const r of rows) {
    await client.query(`ALTER TABLE versements DROP CONSTRAINT "${r.conname}"`);
  }
  await client.query(
    `ALTER TABLE versements ADD CONSTRAINT versements_type_check
     CHECK (type IN ('loyer','avance','caution','arriere'))`
  );
}

module.exports = { up };
