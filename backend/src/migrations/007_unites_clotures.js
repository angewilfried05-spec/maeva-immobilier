// ============================================================
//  MAEVA IMMOBILIER — Unités physiques + clôtures mensuelles
//
//  unites    : la porte physique (ex. « 12 » du bâtiment CGR), propriétaire
//              de ses contrats successifs. Une unité sans contrat actif est
//              simplement libre — fini les lignes « (PORTE VIDE) » obligatoires.
//  contrats  : rôle joué par la table `locataires` (une ligne = une occupation
//              avec son compte, sa caution, ses versements). Chaque contrat
//              pointe désormais sur son unité.
//  clotures  : un mois clôturé devient immuable (plus d'écriture dessus) ;
//              on y fige le montant remis au propriétaire.
// ============================================================

const SCHEMA = `
CREATE TABLE IF NOT EXISTS unites (
  id          SERIAL PRIMARY KEY,
  batiment_id INTEGER NOT NULL REFERENCES batiments (id) ON DELETE CASCADE,
  porte       VARCHAR(50),
  loyer_base  INTEGER NOT NULL DEFAULT 0,              -- loyer habituel de la porte
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batiment_id, porte)                          -- porte NULL : plusieurs NULL possibles
);

ALTER TABLE locataires ADD COLUMN IF NOT EXISTS unite_id INTEGER REFERENCES unites (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_locataires_unite ON locataires (unite_id);

CREATE TABLE IF NOT EXISTS clotures (
  mois                CHAR(7) PRIMARY KEY,
  remis_proprietaire  INTEGER,
  cloture_par         INTEGER REFERENCES utilisateurs (id) ON DELETE SET NULL,
  cloture_le          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decloture_par       INTEGER REFERENCES utilisateurs (id) ON DELETE SET NULL,
  decloture_le        TIMESTAMPTZ
);
`;

// Crée les unités à partir des portes existantes et relie chaque contrat à la sienne.
// Idempotent : ne crée que ce qui manque, ne relie que les lignes sans unité.
async function convertir(client) {
  // Une unité par couple (bâtiment, porte) ; loyer_base = loyer du contrat le plus récent
  await client.query(`
    INSERT INTO unites (batiment_id, porte, loyer_base)
    SELECT DISTINCT ON (l.batiment_id, l.numero_porte)
           l.batiment_id, l.numero_porte, COALESCE(l.loyer_mensuel, 0)
    FROM locataires l
    WHERE l.numero_porte IS NOT NULL AND trim(l.numero_porte) <> ''
    ORDER BY l.batiment_id, l.numero_porte, l.statut = 'Actif' DESC, l.updated_at DESC
    ON CONFLICT (batiment_id, porte) DO NOTHING`);

  await client.query(`
    UPDATE locataires l SET unite_id = u.id
    FROM unites u
    WHERE l.unite_id IS NULL AND l.numero_porte IS NOT NULL
      AND u.batiment_id = l.batiment_id AND u.porte = l.numero_porte`);

  // Porte non renseignée : une unité propre à chaque contrat restant
  const { rows: orphelins } = await client.query(
    'SELECT id, batiment_id, loyer_mensuel FROM locataires WHERE unite_id IS NULL ORDER BY id'
  );
  for (const l of orphelins) {
    const { rows } = await client.query(
      'INSERT INTO unites (batiment_id, porte, loyer_base) VALUES ($1, NULL, $2) RETURNING id',
      [l.batiment_id, l.loyer_mensuel || 0]
    );
    await client.query('UPDATE locataires SET unite_id = $1 WHERE id = $2', [rows[0].id, l.id]);
  }
}

async function up(client) {
  await client.query(SCHEMA);
  await convertir(client);
}

module.exports = { up, convertir };
