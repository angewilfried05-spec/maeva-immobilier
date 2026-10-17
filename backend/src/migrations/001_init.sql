-- ============================================================
--  MAEVA IMMOBILIER — Schéma initial
-- ============================================================

CREATE TABLE IF NOT EXISTS utilisateurs (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  nom_complet     VARCHAR(200) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'lecteur'
                  CHECK (role IN ('admin','gerant','comptable','lecteur')),
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  last_login      TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batiments (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  adresse     VARCHAR(255),
  note        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_batiments_nom ON batiments (nom);

CREATE TABLE IF NOT EXISTS locataires (
  id                SERIAL PRIMARY KEY,
  batiment_id       INTEGER NOT NULL REFERENCES batiments (id) ON DELETE CASCADE,
  numero_porte      VARCHAR(50),
  nom_locataire     VARCHAR(200) NOT NULL,
  loyer_mensuel     INTEGER NOT NULL DEFAULT 0,
  date_entree       DATE,
  statut            VARCHAR(20) NOT NULL DEFAULT 'Actif'
                    CHECK (statut IN ('Actif','Vide','Parti')),
  telephone         VARCHAR(50),
  note              TEXT,
  arrieres_initial  INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_locataires_batiment ON locataires (batiment_id);
CREATE INDEX IF NOT EXISTS idx_locataires_nom ON locataires (nom_locataire);

CREATE TABLE IF NOT EXISTS paiements (
  id                    SERIAL PRIMARY KEY,
  locataire_id          INTEGER NOT NULL REFERENCES locataires (id) ON DELETE CASCADE,
  mois                  CHAR(7) NOT NULL,            -- 'AAAA-MM'
  quantite_mois_payee   NUMERIC(6,2) NOT NULL DEFAULT 0,
  montant_unitaire      INTEGER NOT NULL DEFAULT 0,
  montant_total_paye    INTEGER NOT NULL DEFAULT 0,
  date_paiement         DATE,
  note                  TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (locataire_id, mois)
);
CREATE INDEX IF NOT EXISTS idx_paiements_mois ON paiements (mois);
CREATE INDEX IF NOT EXISTS idx_paiements_locataire ON paiements (locataire_id);

CREATE TABLE IF NOT EXISTS depenses (
  id                SERIAL PRIMARY KEY,
  mois              CHAR(7) NOT NULL,
  designation       VARCHAR(255) NOT NULL,
  categorie         VARCHAR(30) NOT NULL DEFAULT 'Autre'
                    CHECK (categorie IN ('Salaires','Charges','Travaux','Remboursements','Autre')),
  quantite          NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_unitaire  INTEGER NOT NULL DEFAULT 0,
  montant_total     INTEGER NOT NULL DEFAULT 0,
  beneficiaire      VARCHAR(150),
  note              TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_depenses_mois ON depenses (mois);

CREATE TABLE IF NOT EXISTS resumes (
  id                              SERIAL PRIMARY KEY,
  mois                            CHAR(7) NOT NULL UNIQUE,
  total_loyers_attendus           INTEGER NOT NULL DEFAULT 0,
  total_loyers_percus             INTEGER NOT NULL DEFAULT 0,
  total_depenses                  INTEGER NOT NULL DEFAULT 0,
  solde                           INTEGER NOT NULL DEFAULT 0,
  montant_remis_au_proprietaire   INTEGER NOT NULL DEFAULT 0,
  updated_at                      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
  cle       VARCHAR(100) PRIMARY KEY,
  valeur    TEXT
);
