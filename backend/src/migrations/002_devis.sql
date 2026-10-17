-- ============================================================
--  MAEVA IMMOBILIER — Module Devis BTP (construction & rénovation)
-- ============================================================

-- Catalogue d'articles réutilisables (matériaux + main d'œuvre)
CREATE TABLE IF NOT EXISTS catalogue_articles (
  id                    SERIAL PRIMARY KEY,
  designation           VARCHAR(255) NOT NULL,
  categorie             VARCHAR(30) NOT NULL DEFAULT 'Matériaux'
                        CHECK (categorie IN ('Matériaux','Main d''œuvre')),
  unite                 VARCHAR(50) NOT NULL DEFAULT 'forfait',
  prix_unitaire_reference INTEGER NOT NULL DEFAULT 0,
  date_maj              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalogue_categorie ON catalogue_articles (categorie);
CREATE INDEX IF NOT EXISTS idx_catalogue_designation ON catalogue_articles (designation);

-- Devis (en-tête)
CREATE TABLE IF NOT EXISTS devis (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(50) NOT NULL UNIQUE,    -- format N°XXXX/MAEVA IM/XXX
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  lieu            VARCHAR(150) NOT NULL DEFAULT 'Abidjan',
  titre_objet     VARCHAR(255) NOT NULL,
  client_nom      VARCHAR(200) NOT NULL DEFAULT '',
  client_contact  VARCHAR(255),
  type            VARCHAR(30) NOT NULL DEFAULT 'Autre'
                  CHECK (type IN ('Construction neuve','Rénovation','Clôture','Autre')),
  taux_tva        NUMERIC(5,2) NOT NULL DEFAULT 0,
  statut          VARCHAR(20) NOT NULL DEFAULT 'Brouillon'
                  CHECK (statut IN ('Brouillon','Envoyé','Accepté','Refusé','Facturé')),
  batiment_id     INTEGER REFERENCES batiments (id) ON DELETE SET NULL,  -- rattachement optionnel
  note            TEXT,
  total_materiel  INTEGER NOT NULL DEFAULT 0,
  total_mo        INTEGER NOT NULL DEFAULT 0,
  total_tva       INTEGER NOT NULL DEFAULT 0,
  total_general   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis (statut);
CREATE INDEX IF NOT EXISTS idx_devis_date ON devis (date);
CREATE INDEX IF NOT EXISTS idx_devis_client ON devis (client_nom);

-- Lignes de devis
CREATE TABLE IF NOT EXISTS lignes_devis (
  id              SERIAL PRIMARY KEY,
  devis_id        INTEGER NOT NULL REFERENCES devis (id) ON DELETE CASCADE,
  article_id      INTEGER REFERENCES catalogue_articles (id) ON DELETE SET NULL,
  designation     VARCHAR(255) NOT NULL,
  categorie       VARCHAR(30) NOT NULL DEFAULT 'Matériaux'
                  CHECK (categorie IN ('Matériaux','Main d''œuvre')),
  quantite        NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_unitaire   INTEGER NOT NULL DEFAULT 0,
  prix_total      INTEGER NOT NULL DEFAULT 0,
  ordre           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lignes_devis ON lignes_devis (devis_id);

-- Séquence pour la numérotation auto des devis
CREATE TABLE IF NOT EXISTS devis_compteur (
  annee    INTEGER PRIMARY KEY,
  numero   INTEGER NOT NULL DEFAULT 0
);
