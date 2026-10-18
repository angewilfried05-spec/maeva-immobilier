const express = require('express');
const path = require('path');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { MOIS_VALIDE, ajouterVersement } = require('../services/loyers');
const { texteOuNull } = require('../utils/fusion');
const { journal } = require('../services/journal');
const { refuserSiCloture } = require('../services/cloture');
const { genererQuittancePdf, dossierTemporaire } = require('../services/quittances');
const { envoyerEtSupprimer } = require('../utils/envoi-fichier');

const router = express.Router();
const SAISIE = requireRole('admin', 'gerant', 'comptable');

// Charge le versement + sa quittance et génère le PDF dans un dossier temporaire.
async function genererFichierQuittance(id) {
  const { rows } = await pool.query(
    `SELECT v.*, q.numero, q.emis_le, l.telephone,
            l.nom_locataire, l.numero_porte, b.nom AS nom_batiment, u.nom_complet AS emetteur
     FROM versements v
     JOIN quittances q ON q.versement_id = v.id
     JOIN locataires l ON l.id = v.locataire_id
     JOIN batiments b ON b.id = l.batiment_id
     LEFT JOIN utilisateurs u ON u.id = q.emis_par
     WHERE v.id = $1`, [id]
  );
  const r = rows[0];
  if (!r) return null;
  const { rows: cfg } = await pool.query('SELECT cle, valeur FROM config');
  const config = Object.fromEntries(cfg.map((c) => [c.cle, c.valeur]));
  const dossier = dossierTemporaire();
  const fichier = path.join(dossier, `quittance_${r.numero}.pdf`);
  await genererQuittancePdf({
    quittance: { numero: r.numero, emis_le: r.emis_le },
    versement: r,
    locataire: { nom_locataire: r.nom_locataire, numero_porte: r.numero_porte },
    batiment: { nom_batiment: r.nom_batiment },
    config, emetteur: r.emetteur,
  }, fichier);
  return { r, fichier, dossier };
}

// GET /api/versements?mois=&locataire_id=
router.get('/', requireAuth, async (req, res) => {
  const { mois, locataire_id } = req.query;
  try {
    const params = [];
    const where = [];
    if (mois) { params.push(mois); where.push(`v.mois = $${params.length}`); }
    if (locataire_id) { params.push(Number(locataire_id)); where.push(`v.locataire_id = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT v.*, q.numero AS numero_quittance
       FROM versements v LEFT JOIN quittances q ON q.versement_id = v.id
       ${where.length ? ' WHERE ' + where.join(' AND ') : ''}
       ORDER BY v.mois DESC, v.date_versement, v.id`, params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/versements/:id/quittance  → PDF téléchargeable
router.get('/:id/quittance', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const gen = await genererFichierQuittance(id);
    if (!gen) return res.status(404).json({ message: 'Versement ou quittance introuvable' });
    envoyerEtSupprimer(res, gen.fichier, gen.dossier);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// POST /api/versements/:id/quittance/whatsapp  → envoie le PDF au locataire via
// le client WhatsApp du serveur (503 si non connecté — le lien wa.me reste possible).
router.post('/:id/quittance/whatsapp', requireAuth, SAISIE, async (req, res) => {
  const id = Number(req.params.id);
  const fs = require('fs/promises');
  let dossier = null;
  try {
    const gen = await genererFichierQuittance(id);
    if (!gen) return res.status(404).json({ message: 'Versement ou quittance introuvable' });
    dossier = gen.dossier;
    if (!gen.r.telephone) {
      await fs.rm(dossier, { recursive: true, force: true });
      return res.status(400).json({ message: 'Ce locataire n\'a pas de numéro de téléphone' });
    }
    const wa = require('../services/whatsapp');
    const legende = `Quittance ${gen.r.numero} — loyer ${gen.r.mois}`;
    const r = await wa.envoyerDocument(gen.r.telephone, gen.fichier, legende);
    await fs.rm(dossier, { recursive: true, force: true });
    if (!r.success) return res.status(503).json({ message: r.error || 'WhatsApp non connecté' });
    await journal(null, req, 'quittance.whatsapp', 'versement', id,
      { quittance: gen.r.numero, simulated: !!r.simulated });
    res.json({ ok: true, simulated: !!r.simulated });
  } catch (e) {
    if (dossier) await fs.rm(dossier, { recursive: true, force: true }).catch(() => {});
    res.status(500).json({ message: 'Erreur serveur: ' + e.message });
  }
});

// POST /api/versements  { locataire_id, mois, montant, date_versement?, mode?, note?, cle_idempotence? }
router.post('/', requireAuth, SAISIE, async (req, res) => {
  const { locataire_id, mois, montant, date_versement, mode, note, cle_idempotence } = req.body || {};
  const m = Math.round(Number(montant));
  if (!locataire_id || !MOIS_VALIDE.test(String(mois || ''))) return res.status(400).json({ message: 'Locataire et mois requis' });
  if (!(m > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0' });
  try {
    if (await refuserSiCloture(res, mois)) return;
    const loc = await pool.query('SELECT statut FROM locataires WHERE id = $1', [Number(locataire_id)]);
    if (!loc.rows[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    if (loc.rows[0].statut === 'Vide') return res.status(400).json({ message: 'Porte vide : aucun loyer à encaisser' });
    const v = await ajouterVersement(pool, {
      locataire_id: Number(locataire_id), mois, montant: m, date_versement, mode,
      note: texteOuNull(note), created_by: req.utilisateur.id,
      cle_idempotence: texteOuNull(cle_idempotence),
    });
    if (!v.existant) {
      await recalculerResume(mois);
      await journal(null, req, 'versement.cree', 'versement', v.id,
        { locataire_id: v.locataire_id, mois: v.mois, montant: v.montant, mode: v.mode, quittance: v.numero_quittance });
      // Quittance PDF envoyée au locataire par WhatsApp si le client est lié
      // (asynchrone : ne bloque ni ne fait échouer l'encaissement).
      require('../services/notifications').notifierVersement(v.id);
    }
    res.status(v.existant ? 200 : 201).json(v);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// PUT /api/versements/note  { locataire_id, mois, note }  (note du mois ; vide = supprimée)
router.put('/note', requireAuth, SAISIE, async (req, res) => {
  const { locataire_id, mois } = req.body || {};
  const note = texteOuNull(req.body?.note);
  if (!locataire_id || !MOIS_VALIDE.test(String(mois || ''))) return res.status(400).json({ message: 'Locataire et mois requis' });
  try {
    if (await refuserSiCloture(res, mois)) return;
    if (note) {
      await pool.query(
        `INSERT INTO notes_loyers (locataire_id, mois, note) VALUES ($1, $2, $3)
         ON CONFLICT (locataire_id, mois) DO UPDATE SET note = EXCLUDED.note`, [Number(locataire_id), mois, note]
      );
    } else {
      await pool.query('DELETE FROM notes_loyers WHERE locataire_id = $1 AND mois = $2', [Number(locataire_id), mois]);
    }
    await journal(null, req, 'versement.note', 'locataire', Number(locataire_id), { mois, note });
    res.json({ ok: true, note });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/versements/:id  — réservé à l'admin. Le versement et sa quittance
// (ON DELETE CASCADE) sont supprimés ; tout est conservé dans le journal d'audit,
// motif d'annulation inclus (body ou ?motif=).
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const ex = await pool.query(
      `SELECT v.*, q.numero AS quittance, l.nom_locataire
       FROM versements v
       LEFT JOIN quittances q ON q.versement_id = v.id
       JOIN locataires l ON l.id = v.locataire_id
       WHERE v.id = $1`, [Number(req.params.id)]);
    const v = ex.rows[0];
    if (!v) return res.status(404).json({ message: 'Versement introuvable' });
    if (await refuserSiCloture(res, v.mois)) return;
    const motif = texteOuNull(req.body?.motif) || texteOuNull(req.query.motif);
    await pool.query('DELETE FROM versements WHERE id = $1', [v.id]);
    await recalculerResume(v.mois);
    await journal(null, req, 'versement.supprime', 'versement', v.id, {
      locataire_id: v.locataire_id, locataire: v.nom_locataire, mois: v.mois,
      montant: v.montant, mode: v.mode, type: v.type,
      date_versement: v.date_versement, quittance: v.quittance || null, motif,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
