const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { fusionner, texteOuNull, entier } = require('../utils/fusion');
const { transaction } = require('../utils/transaction');
const { chargerSituations, moisCourant, moisSuivant } = require('../services/situation');
const { recalculerResume } = require('../services/resume');
const { MOIS_VALIDE, moisDe, majLoyer, ajouterVersement } = require('../services/loyers');
const { journal } = require('../services/journal');
const { refuserSiCloture } = require('../services/cloture');
const { unitePour } = require('../services/unites');

const router = express.Router();
const GESTION = requireRole('admin', 'gerant');

// Premier mois dû : choisi explicitement, sinon mois de la date d'entrée, sinon mois courant
function debutSuivi(body, dateEntree) {
  return MOIS_VALIDE.test(String(body.debut_suivi || '')) ? body.debut_suivi : (moisDe(dateEntree) || moisCourant());
}

async function enregistrerAvance(client, locataireId, mois, montant, date, userId) {
  if (montant > 0) {
    await ajouterVersement(client, {
      locataire_id: locataireId, mois, montant, date_versement: date, type: 'avance',
      note: "Avance versée à l'entrée", created_by: userId,
    });
  }
}

// GET /api/locataires?batiment_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { batiment_id } = req.query;
    const params = [];
    let sql = 'SELECT * FROM locataires';
    if (batiment_id) { sql += ' WHERE batiment_id = $1'; params.push(Number(batiment_id)); }
    sql += ' ORDER BY batiment_id, numero_porte NULLS LAST, nom_locataire';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/locataires/:id?mois=  (fiche : versements, historique des loyers, situation)
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const mois = MOIS_VALIDE.test(String(req.query.mois || '')) ? req.query.mois : moisCourant();
  try {
    const { locataires, situations } = await chargerSituations(mois, [id]);
    if (!locataires[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    const versements = await pool.query(
      `SELECT v.*, q.numero AS numero_quittance FROM versements v
       LEFT JOIN quittances q ON q.versement_id = v.id
       WHERE v.locataire_id = $1 ORDER BY v.mois DESC, v.date_versement DESC, v.id DESC`, [id]
    );
    const loyers = await pool.query('SELECT a_partir_de, montant FROM loyers_historique WHERE locataire_id = $1 ORDER BY a_partir_de DESC', [id]);
    const notes = await pool.query('SELECT mois, note FROM notes_loyers WHERE locataire_id = $1 ORDER BY mois DESC', [id]);
    res.json({ ...locataires[0], situation: situations[id], versements: versements.rows, loyers: loyers.rows, notes: notes.rows });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/locataires/:id/depart-apercu?mois=  (situation si le locataire part à la fin de ce mois)
router.get('/:id/depart-apercu', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const mois = String(req.query.mois || '');
  if (!MOIS_VALIDE.test(mois)) return res.status(400).json({ message: 'Mois de sortie invalide' });
  try {
    const { locataires, situations } = await chargerSituations(mois, [id], { [id]: { mois_sortie: mois } });
    if (!locataires[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    res.json({ situation: situations[id], caution: locataires[0].caution });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/locataires  (admin, gerant) — caution / avance optionnelles
//   unite_id : occuper une porte existante (réutilise sa ligne « Vide » si présente)
router.post('/', requireAuth, GESTION, async (req, res) => {
  const b = req.body || {};
  const nom = texteOuNull(b.nom_locataire);
  let uniteId = b.unite_id ? Number(b.unite_id) : null;
  try {
    // Résolution de l'unité : le bâtiment et la porte viennent d'elle
    let unite = null;
    if (uniteId) {
      unite = (await pool.query('SELECT * FROM unites WHERE id = $1', [uniteId])).rows[0];
      if (!unite) return res.status(404).json({ message: 'Unité introuvable' });
      const occupee = await pool.query(
        "SELECT 1 FROM locataires WHERE unite_id = $1 AND statut = 'Actif'", [uniteId]
      );
      if (occupee.rows[0]) return res.status(409).json({ message: 'Cette unité est déjà occupée' });
    }
    const batimentId = unite ? unite.batiment_id : Number(b.batiment_id);
    const porte = unite ? unite.porte : texteOuNull(b.numero_porte);
    if (!batimentId || !nom) return res.status(400).json({ message: 'Bâtiment et nom requis' });
    const statut = b.statut === 'Vide' ? 'Vide' : 'Actif';
    const loyer = entier(b.loyer_mensuel) || (unite ? unite.loyer_base : 0);
    const dateEntree = texteOuNull(b.date_entree);
    const debut = statut === 'Actif' ? debutSuivi(b, dateEntree) : null;
    if (debut && await refuserSiCloture(res, debut)) return;

    const loc = await transaction(async (client) => {
      if (!uniteId) uniteId = await unitePour(client, batimentId, porte, loyer);
      if (statut === 'Actif') {
        // Jamais deux contrats actifs sur la même porte physique
        const conflit = await client.query(
          "SELECT 1 FROM locataires WHERE unite_id = $1 AND statut = 'Actif'", [uniteId]
        );
        if (conflit.rows[0]) {
          const err = new Error('Cette porte est déjà occupée'); err.code = 'OCCUPEE';
          throw err;
        }
      }
      // Une ligne « Vide » existe sur cette unité : on la transforme en occupation
      const vide = uniteId ? await client.query(
        "SELECT id FROM locataires WHERE unite_id = $1 AND statut = 'Vide' ORDER BY id LIMIT 1", [uniteId]
      ) : { rows: [] };
      let locataireId;
      if (vide.rows[0] && statut === 'Actif') {
        locataireId = vide.rows[0].id;
        await client.query(
          `UPDATE locataires SET nom_locataire=$1, loyer_mensuel=$2, date_entree=$3, statut='Actif',
             telephone=$4, note=$5, debut_suivi=$6, solde_initial=$7, caution=$8, mois_sortie=NULL,
             updated_at=CURRENT_TIMESTAMP WHERE id=$9`,
          [nom, loyer, dateEntree, texteOuNull(b.telephone), texteOuNull(b.note), debut,
           entier(b.solde_initial), entier(b.caution), locataireId]
        );
        // La ligne Vide n'avait aucun versement : son historique repart du nouveau loyer
        await client.query('DELETE FROM loyers_historique WHERE locataire_id = $1', [locataireId]);
        await client.query('DELETE FROM notes_loyers WHERE locataire_id = $1', [locataireId]);
      } else {
        const { rows } = await client.query(
          `INSERT INTO locataires (batiment_id, numero_porte, nom_locataire, loyer_mensuel, date_entree, statut, telephone, note,
                                   debut_suivi, solde_initial, caution, unite_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [batimentId, porte, nom, loyer, dateEntree, statut,
           texteOuNull(b.telephone), texteOuNull(b.note), debut,
           statut === 'Actif' ? entier(b.solde_initial) : 0, statut === 'Actif' ? entier(b.caution) : 0, uniteId]
        );
        locataireId = rows[0].id;
      }
      await majLoyer(client, locataireId, debut || moisCourant(), loyer);
      if (statut === 'Actif') await enregistrerAvance(client, locataireId, debut, entier(b.avance), dateEntree, req.utilisateur.id);
      await journal(client, req, 'locataire.cree', 'locataire', locataireId,
        { nom, batiment_id: batimentId, porte, unite_id: uniteId, loyer });
      return (await client.query('SELECT * FROM locataires WHERE id = $1', [locataireId])).rows[0];
    });
    if (debut) await recalculerResume(debut);
    res.status(201).json(loc);
  } catch (e) {
    if (e.code === 'OCCUPEE') return res.status(409).json({ message: e.message });
    res.status(500).json({ message: 'Erreur serveur: ' + e.message });
  }
});

// PUT /api/locataires/:id  (admin, gerant)
//   loyer_a_partir_de : mois d'application d'un nouveau loyer (défaut : mois courant)
//   Porte vide -> occupée : nouveau compte (début du suivi, caution, avance)
router.put('/:id', requireAuth, GESTION, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  try {
    const ex = (await pool.query('SELECT * FROM locataires WHERE id = $1', [id])).rows[0];
    if (!ex) return res.status(404).json({ message: 'Locataire introuvable' });
    const v = fusionner(ex, b, {
      batiment_id: Number, numero_porte: texteOuNull, nom_locataire: texteOuNull, loyer_mensuel: entier,
      date_entree: texteOuNull, statut: texteOuNull, telephone: texteOuNull, note: texteOuNull,
      solde_initial: entier, caution: entier, debut_suivi: texteOuNull,
    });
    if (!v.batiment_id || !v.nom_locataire) return res.status(400).json({ message: 'Bâtiment et nom requis' });
    if (v.statut !== ex.statut) {
      const autorise = (ex.statut === 'Vide' && v.statut === 'Actif') || (ex.statut === 'Parti' && v.statut === 'Actif');
      if (!autorise) return res.status(400).json({ message: 'Pour un départ, utilisez le bouton « Départ »' });
    }
    const devientOccupe = ex.statut === 'Vide' && v.statut === 'Actif';
    if (devientOccupe) v.debut_suivi = debutSuivi(b, v.date_entree);
    else if (v.statut !== 'Vide' && !v.debut_suivi) v.debut_suivi = ex.debut_suivi || debutSuivi(b, v.date_entree);
    if (ex.statut === 'Vide' && !devientOccupe) { v.debut_suivi = null; v.solde_initial = 0; v.caution = 0; }
    if (v.debut_suivi && !MOIS_VALIDE.test(v.debut_suivi)) return res.status(400).json({ message: 'Début du suivi invalide (AAAA-MM)' });
    const moisSortie = ex.statut === 'Parti' && v.statut === 'Actif' ? null : ex.mois_sortie;
    // Révision de loyer datée : impossible sur un mois clôturé (hors transaction — une
    // réponse 409 envoyée pendant la transaction serait suivie d'un second res.json)
    const loyerChange = !devientOccupe && v.loyer_mensuel !== ex.loyer_mensuel;
    const aPartirDe = loyerChange
      ? (MOIS_VALIDE.test(String(b.loyer_a_partir_de || '')) ? b.loyer_a_partir_de : moisCourant())
      : null;
    if (aPartirDe && await refuserSiCloture(res, aPartirDe)) return;
    if (devientOccupe && v.debut_suivi && await refuserSiCloture(res, v.debut_suivi)) return;

    const loc = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE locataires SET batiment_id=$1, numero_porte=$2, nom_locataire=$3, loyer_mensuel=$4, date_entree=$5,
           statut=$6, telephone=$7, note=$8, solde_initial=$9, caution=$10, debut_suivi=$11, mois_sortie=$12,
           updated_at=CURRENT_TIMESTAMP
         WHERE id = $13 RETURNING *`,
        [v.batiment_id, v.numero_porte, v.nom_locataire, v.loyer_mensuel, v.date_entree, v.statut, v.telephone, v.note,
         v.solde_initial, v.caution, v.debut_suivi, moisSortie, id]
      );
      if (devientOccupe) {
        await majLoyer(client, id, v.debut_suivi, v.loyer_mensuel);
        await enregistrerAvance(client, id, v.debut_suivi, entier(b.avance), v.date_entree, req.utilisateur.id);
      } else if (loyerChange) {
        await majLoyer(client, id, aPartirDe, v.loyer_mensuel);
      }
      await journal(client, req, 'locataire.modifie', 'locataire', id,
        { champs: Object.keys(b), statut: v.statut, loyer: v.loyer_mensuel });
      return rows[0];
    });
    res.json(loc);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// POST /api/locataires/:id/depart  (admin, gerant)
//   { mois_sortie, retenue, remboursement, depense_remboursement, porte_vide }
//   retenue : part de la caution qui solde la dette ; remboursement : caution rendue au locataire
router.post('/:id/depart', requireAuth, GESTION, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const mois = String(b.mois_sortie || '');
  if (!MOIS_VALIDE.test(mois)) return res.status(400).json({ message: 'Mois de sortie invalide' });
  try {
    const { locataires, situations } = await chargerSituations(mois, [id], { [id]: { mois_sortie: mois } });
    const loc = locataires[0];
    if (!loc) return res.status(404).json({ message: 'Locataire introuvable' });
    if (loc.statut !== 'Actif') return res.status(400).json({ message: 'Seul un locataire actif peut partir' });
    if (loc.debut_suivi && mois < loc.debut_suivi) return res.status(400).json({ message: 'Le mois de sortie précède le début du suivi' });
    if (await refuserSiCloture(res, mois)) return;
    const dette = situations[id].dette;
    const retenue = entier(b.retenue);
    const remboursement = entier(b.remboursement);
    if (retenue < 0 || remboursement < 0) return res.status(400).json({ message: 'Montants invalides' });
    if (retenue > dette) return res.status(400).json({ message: 'La retenue dépasse la dette' });
    if (retenue + remboursement > loc.caution) return res.status(400).json({ message: 'Retenue + remboursement dépassent la caution' });

    await transaction(async (client) => {
      await client.query(
        `UPDATE locataires SET statut='Parti', mois_sortie=$1, caution_retenue=$2, caution_remboursee=$3, updated_at=CURRENT_TIMESTAMP
         WHERE id = $4`, [mois, retenue, remboursement, id]
      );
      if (retenue > 0) {
        await ajouterVersement(client, {
          locataire_id: id, mois, montant: retenue, type: 'caution',
          note: 'Retenue sur caution au départ', created_by: req.utilisateur.id,
        });
      }
      if (b.depense_remboursement && remboursement > 0) {
        await client.query(
          `INSERT INTO depenses (mois, designation, categorie, quantite, montant_unitaire, montant_total, beneficiaire)
           VALUES ($1, $2, 'Remboursements', 1, $3, $3, $4)`,
          [mois, `REMBOURSEMENT CAUTION ${loc.nom_locataire}`.toUpperCase(), remboursement, loc.nom_locataire]
        );
      }
      if (b.porte_vide) {
        const { rows } = await client.query(
          `INSERT INTO locataires (batiment_id, numero_porte, nom_locataire, loyer_mensuel, statut, unite_id)
           VALUES ($1, $2, '(PORTE VIDE)', $3, 'Vide', $4) RETURNING id`,
          [loc.batiment_id, loc.numero_porte, loc.loyer_mensuel, loc.unite_id]
        );
        await majLoyer(client, rows[0].id, moisSuivant(mois), loc.loyer_mensuel);
      }
      await journal(client, req, 'locataire.depart', 'locataire', id,
        { nom: loc.nom_locataire, mois_sortie: mois, dette, retenue, remboursement, porte_vide: Boolean(b.porte_vide) });
    });
    await recalculerResume(mois);
    const apres = await chargerSituations(mois, [id]);
    res.json({ ok: true, situation: apres.situations[id] });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// DELETE /api/locataires/:id  (admin, gerant)
router.delete('/:id', requireAuth, GESTION, async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Suppression impossible si des écritures existent sur un mois clôturé (elles disparaîtraient)
    const clot = await pool.query(
      `SELECT 1 FROM versements v JOIN clotures c ON c.mois = v.mois AND c.decloture_le IS NULL
       WHERE v.locataire_id = $1
       UNION ALL
       SELECT 1 FROM notes_loyers n JOIN clotures c ON c.mois = n.mois AND c.decloture_le IS NULL
       WHERE n.locataire_id = $1
       LIMIT 1`, [id]
    );
    if (clot.rows[0]) return res.status(409).json({ message: 'Ce locataire a des écritures sur un mois clôturé', code: 'MOIS_CLOTURE' });
    const r = await pool.query('DELETE FROM locataires WHERE id = $1 RETURNING nom_locataire, numero_porte', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Locataire introuvable' });
    await journal(null, req, 'locataire.supprime', 'locataire', id,
      { nom: r.rows[0].nom_locataire, porte: r.rows[0].numero_porte });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
