// Opérations d'écriture sur le compte d'un locataire.
const MOIS_VALIDE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];
const TYPES = ['loyer', 'avance', 'caution', 'arriere'];

const moisDe = (date) => (date ? String(date).slice(0, 7) : null);

// Loyer applicable à partir d'un mois (remplace un changement déjà saisi pour ce mois)
async function majLoyer(client, locataireId, aPartirDe, montant) {
  await client.query(
    `INSERT INTO loyers_historique (locataire_id, a_partir_de, montant) VALUES ($1, $2, $3)
     ON CONFLICT (locataire_id, a_partir_de) DO UPDATE SET montant = EXCLUDED.montant`,
    [locataireId, aPartirDe, montant]
  );
}

// cle_idempotence : clé unique générée par le client pour un encaissement.
// Renvoyer le même versement (réseau instable, double clic) renvoie l'existant
// au lieu de créer un doublon.
async function ajouterVersement(client, { locataire_id, mois, montant, date_versement, type = 'loyer', mode = 'Espèces', note = null, importe = false, created_by = null, cle_idempotence = null }) {
  const { emettre } = require('./quittances');
  const { rows } = await client.query(
    `INSERT INTO versements (locataire_id, mois, montant, date_versement, type, mode, note, importe, created_by, cle_idempotence)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, $9, $10)
     ON CONFLICT (cle_idempotence) WHERE cle_idempotence IS NOT NULL DO NOTHING
     RETURNING *`,
    [locataire_id, mois, montant, date_versement || null, TYPES.includes(type) ? type : 'loyer', MODES.includes(mode) ? mode : 'Espèces', note, importe, created_by, cle_idempotence]
  );
  let v = rows[0];
  let existant = false;
  if (!v) {
    v = (await client.query('SELECT * FROM versements WHERE cle_idempotence = $1', [cle_idempotence])).rows[0];
    existant = true;
  }
  const numero_quittance = await emettre(client, v.id, created_by);
  return { ...v, numero_quittance, existant };
}

module.exports = { MOIS_VALIDE, MODES, moisDe, majLoyer, ajouterVersement };
