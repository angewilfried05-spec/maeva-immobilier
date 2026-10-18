// Unités physiques : une porte réelle du bâtiment, propriétaire de ses
// contrats d'occupation successifs (les lignes `locataires`).
// Porte NULL : unité anonyme — une par contrat, jamais réutilisée.

// Renvoie l'unité de (bâtiment, porte), en la créant si besoin.
// À appeler dans une transaction (client) pour éviter les doublons concurrents.
async function unitePour(client, batimentId, porte, loyerBase = 0) {
  const p = porte == null ? null : String(porte).trim();
  if (p) {
    const ex = await client.query(
      'SELECT id FROM unites WHERE batiment_id = $1 AND porte = $2', [batimentId, p]
    );
    if (ex.rows[0]) return ex.rows[0].id;
    const ins = await client.query(
      `INSERT INTO unites (batiment_id, porte, loyer_base) VALUES ($1, $2, $3)
       ON CONFLICT (batiment_id, porte) DO NOTHING RETURNING id`,
      [batimentId, p, loyerBase]
    );
    if (ins.rows[0]) return ins.rows[0].id;
    // Conflit concurrent : relire
    return (await client.query('SELECT id FROM unites WHERE batiment_id = $1 AND porte = $2', [batimentId, p])).rows[0].id;
  }
  const { rows } = await client.query(
    'INSERT INTO unites (batiment_id, porte, loyer_base) VALUES ($1, NULL, $2) RETURNING id',
    [batimentId, loyerBase]
  );
  return rows[0].id;
}

module.exports = { unitePour };
