// Opérations d'écriture sur le compte d'un locataire.
const MOIS_VALIDE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];

const moisDe = (date) => (date ? String(date).slice(0, 7) : null);

// Loyer applicable à partir d'un mois (remplace un changement déjà saisi pour ce mois)
async function majLoyer(client, locataireId, aPartirDe, montant) {
  await client.query(
    `INSERT INTO loyers_historique (locataire_id, a_partir_de, montant) VALUES ($1, $2, $3)
     ON CONFLICT (locataire_id, a_partir_de) DO UPDATE SET montant = EXCLUDED.montant`,
    [locataireId, aPartirDe, montant]
  );
}

async function ajouterVersement(client, { locataire_id, mois, montant, date_versement, type = 'loyer', mode = 'Espèces', note = null, importe = false, created_by = null }) {
  const { rows } = await client.query(
    `INSERT INTO versements (locataire_id, mois, montant, date_versement, type, mode, note, importe, created_by)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, $9) RETURNING *`,
    [locataire_id, mois, montant, date_versement || null, type, MODES.includes(mode) ? mode : 'Espèces', note, importe, created_by]
  );
  return rows[0];
}

module.exports = { MOIS_VALIDE, MODES, moisDe, majLoyer, ajouterVersement };
