// ============================================================
//  MAEVA IMMOBILIER — Compte locataire en FCFA
//  Versements multiples par mois, historique des loyers, notes mensuelles,
//  caution / avance à l'entrée, départ avec retenue sur caution.
//  L'ancienne table `paiements` est conservée telle quelle (non utilisée).
// ============================================================

const SCHEMA = `
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS debut_suivi CHAR(7);          -- premier mois dû ('AAAA-MM')
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS solde_initial INTEGER NOT NULL DEFAULT 0;  -- dette avant le début du suivi (FCFA)
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS caution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS mois_sortie CHAR(7);          -- dernier mois dû
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS caution_retenue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE locataires ADD COLUMN IF NOT EXISTS caution_remboursee INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyers_historique (
  id            SERIAL PRIMARY KEY,
  locataire_id  INTEGER NOT NULL REFERENCES locataires (id) ON DELETE CASCADE,
  a_partir_de   CHAR(7) NOT NULL,
  montant       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (locataire_id, a_partir_de)
);

CREATE TABLE IF NOT EXISTS versements (
  id              SERIAL PRIMARY KEY,
  locataire_id    INTEGER NOT NULL REFERENCES locataires (id) ON DELETE CASCADE,
  mois            CHAR(7) NOT NULL,                 -- mois de rattachement (liste mensuelle)
  montant         INTEGER NOT NULL CHECK (montant > 0),
  date_versement  DATE NOT NULL DEFAULT CURRENT_DATE,
  type            VARCHAR(20) NOT NULL DEFAULT 'loyer' CHECK (type IN ('loyer','avance','caution')),
  mode            VARCHAR(20) NOT NULL DEFAULT 'Espèces'
                  CHECK (mode IN ('Espèces','Mobile Money','Virement','Chèque')),
  importe         BOOLEAN NOT NULL DEFAULT FALSE,
  note            TEXT,
  created_by      INTEGER REFERENCES utilisateurs (id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_versements_mois ON versements (mois);
CREATE INDEX IF NOT EXISTS idx_versements_locataire ON versements (locataire_id);

CREATE TABLE IF NOT EXISTS notes_loyers (
  locataire_id  INTEGER NOT NULL REFERENCES locataires (id) ON DELETE CASCADE,
  mois          CHAR(7) NOT NULL,
  note          TEXT NOT NULL,
  PRIMARY KEY (locataire_id, mois)
);
`;

// Conversion des données de l'ancien modèle (paiements en "mois payés").
// Idempotente : ne remplit que ce qui manque. Réutilisée à la restauration d'une ancienne sauvegarde.
async function convertir(client) {
  // Début du suivi : date d'entrée, sinon premier mois réellement payé, sinon mois de création
  await client.query(`
    UPDATE locataires l SET debut_suivi = COALESCE(
      to_char(l.date_entree, 'YYYY-MM'),
      (SELECT MIN(mois) FROM paiements p WHERE p.locataire_id = l.id AND p.montant_total_paye > 0),
      to_char(l.created_at, 'YYYY-MM'))
    WHERE l.debut_suivi IS NULL AND l.statut <> 'Vide'`);

  // Arriérés de départ : mois -> FCFA (au loyer appliqué au début)
  await client.query(`
    UPDATE locataires l SET solde_initial = l.arrieres_initial * COALESCE(
      (SELECT montant_unitaire FROM paiements p WHERE p.locataire_id = l.id AND p.montant_unitaire > 0 ORDER BY mois LIMIT 1),
      l.loyer_mensuel)
    WHERE l.solde_initial = 0 AND l.arrieres_initial > 0`);

  await client.query(`
    UPDATE locataires SET mois_sortie = to_char(updated_at, 'YYYY-MM')
    WHERE statut = 'Parti' AND mois_sortie IS NULL`);

  // Historique des loyers reconstruit à partir du loyer enregistré sur chaque paiement
  await client.query(`
    INSERT INTO loyers_historique (locataire_id, a_partir_de, montant)
    SELECT locataire_id, mois, montant_unitaire FROM (
      SELECT locataire_id, mois, montant_unitaire,
             LAG(montant_unitaire) OVER (PARTITION BY locataire_id ORDER BY mois) AS precedent
      FROM paiements WHERE montant_unitaire > 0
    ) t
    WHERE (precedent IS NULL OR precedent <> montant_unitaire)
      AND NOT EXISTS (SELECT 1 FROM loyers_historique h WHERE h.locataire_id = t.locataire_id)
    ON CONFLICT DO NOTHING`);
  await client.query(`
    INSERT INTO loyers_historique (locataire_id, a_partir_de, montant)
    SELECT l.id, COALESCE(l.debut_suivi, to_char(CURRENT_DATE, 'YYYY-MM')), l.loyer_mensuel FROM locataires l
    WHERE NOT EXISTS (SELECT 1 FROM loyers_historique h WHERE h.locataire_id = l.id)
    ON CONFLICT DO NOTHING`);
  // Loyer actuel différent du dernier loyer connu : applicable à partir du mois courant
  await client.query(`
    INSERT INTO loyers_historique (locataire_id, a_partir_de, montant)
    SELECT l.id, to_char(CURRENT_DATE, 'YYYY-MM'), l.loyer_mensuel FROM locataires l
    WHERE l.loyer_mensuel <> (SELECT h.montant FROM loyers_historique h WHERE h.locataire_id = l.id
                              ORDER BY h.a_partir_de DESC LIMIT 1)
    ON CONFLICT (locataire_id, a_partir_de) DO UPDATE SET montant = EXCLUDED.montant`);

  // Chaque paiement devient un versement
  await client.query(`
    INSERT INTO versements (locataire_id, mois, montant, date_versement, type, note)
    SELECT p.locataire_id, p.mois, p.montant_total_paye,
           COALESCE(p.date_paiement, to_date(p.mois, 'YYYY-MM')), 'loyer', 'Repris de l''ancien système'
    FROM paiements p
    WHERE p.montant_total_paye > 0
      AND NOT EXISTS (SELECT 1 FROM versements v WHERE v.locataire_id = p.locataire_id)`);

  await client.query(`
    INSERT INTO notes_loyers (locataire_id, mois, note)
    SELECT locataire_id, mois, note FROM paiements WHERE note IS NOT NULL AND trim(note) <> ''
    ON CONFLICT DO NOTHING`);
}

async function up(client) {
  await client.query(SCHEMA);
  await convertir(client);
}

module.exports = { up, convertir };
