// ============================================================
//  MAEVA IMMOBILIER — Fondations API v1
//  - jetons_refresh   : sessions longue durée avec rotation (mobile + web)
//  - quittances       : reçu numéroté Q-AAAA-NNNNNN pour chaque versement
//  - cle_idempotence  : un encaissement renvoyé en double ne crée jamais
//                       un second versement (réseau mobile instable)
//  - journal_audit    : qui a fait quoi, quand (traçabilité financière)
// ============================================================

const SCHEMA = `
ALTER TABLE versements ADD COLUMN IF NOT EXISTS cle_idempotence TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_versements_cle_idempotence
  ON versements (cle_idempotence) WHERE cle_idempotence IS NOT NULL;

CREATE TABLE IF NOT EXISTS quittances_compteur (
  annee    INTEGER PRIMARY KEY,
  dernier  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quittances (
  id            SERIAL PRIMARY KEY,
  numero        VARCHAR(20) NOT NULL UNIQUE,          -- Q-AAAA-NNNNNN
  versement_id  INTEGER NOT NULL UNIQUE REFERENCES versements (id) ON DELETE CASCADE,
  emis_par      INTEGER REFERENCES utilisateurs (id) ON DELETE SET NULL,
  emis_le       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jetons_refresh (
  id             BIGSERIAL PRIMARY KEY,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs (id) ON DELETE CASCADE,
  hash           TEXT NOT NULL UNIQUE,                -- SHA-256 du jeton, jamais en clair
  famille        TEXT NOT NULL,                       -- identifie une chaîne de rotation
  expire_le      TIMESTAMPTZ NOT NULL,
  revoque_le     TIMESTAMPTZ,
  remplace_par   BIGINT REFERENCES jetons_refresh (id),
  user_agent     TEXT,
  ip             TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jetons_refresh_famille ON jetons_refresh (famille);
CREATE INDEX IF NOT EXISTS idx_jetons_refresh_user ON jetons_refresh (utilisateur_id);

CREATE TABLE IF NOT EXISTS journal_audit (
  id             BIGSERIAL PRIMARY KEY,
  utilisateur_id INTEGER REFERENCES utilisateurs (id) ON DELETE SET NULL,
  action         VARCHAR(50) NOT NULL,                -- ex : versement.cree
  entite         VARCHAR(40),                         -- ex : versement
  entite_id      BIGINT,
  details        JSONB,
  ip             TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entite ON journal_audit (entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON journal_audit (created_at DESC);
`;

// Une quittance par versement déjà enregistré, numérotées dans l'ordre chronologique.
// Idempotent : ne crée que les quittances manquantes.
async function completerQuittances(client) {
  const annee = new Date().getFullYear();
  const { rows: compteur } = await client.query(
    'SELECT dernier FROM quittances_compteur WHERE annee = $1', [annee]
  );
  let n = compteur.length ? Number(compteur[0].dernier) : 0;
  const { rows: sans } = await client.query(
    `SELECT v.id FROM versements v
     WHERE NOT EXISTS (SELECT 1 FROM quittances q WHERE q.versement_id = v.id)
     ORDER BY v.date_versement, v.mois, v.id`
  );
  for (const v of sans) {
    n += 1;
    await client.query('INSERT INTO quittances (numero, versement_id) VALUES ($1, $2)',
      [`Q-${annee}-${String(n).padStart(6, '0')}`, v.id]);
  }
  if (sans.length) {
    await client.query(
      `INSERT INTO quittances_compteur (annee, dernier) VALUES ($1, $2)
       ON CONFLICT (annee) DO UPDATE SET dernier = GREATEST(quittances_compteur.dernier, EXCLUDED.dernier)`,
      [annee, n]
    );
  }
}

async function up(client) {
  await client.query(SCHEMA);
  await completerQuittances(client);
}

module.exports = { up, completerQuittances };
