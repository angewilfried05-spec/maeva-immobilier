const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { chargerSituations, moisCourant } = require('../services/situation');
const { journal } = require('../services/journal');
const wa = require('../services/whatsapp');

const router = express.Router();

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const moisFr = (m) => { const [a, mm] = m.split('-'); return `${MOIS_FR[Number(mm) - 1]} ${a}`; };
const NUM_FMT = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function messageRelance(l, s, mois) {
  return `Bonjour ${l.nom_locataire}, sauf erreur de notre part, votre loyer `
    + `présente un solde de ${NUM_FMT(s.dette)} FCFA (${s.dette_mois} mois) à ${moisFr(mois)}. `
    + `Merci de régulariser. — MAEVA IMMOBILIER`;
}

// GET /api/relances?mois=  — locataires en dette, avec message de relance pré-rempli
// pour WhatsApp (https://wa.me/<tel>?text=…) ou SMS (sms:<tel>?body=…)
router.get('/', requireAuth, async (req, res) => {
  const mois = req.query.mois || moisCourant();
  try {
    const { locataires, situations } = await chargerSituations(mois);
    const bat = {};
    (await require('../config/db').query('SELECT id, nom FROM batiments')).rows.forEach((b) => { bat[b.id] = b.nom; });
    const relances = locataires
      .filter((l) => l.statut === 'Actif' && situations[l.id].dette > 0)
      .map((l) => {
        const s = situations[l.id];
        const message = messageRelance(l, s, mois);
        const tel = String(l.telephone || '').replace(/[^0-9+]/g, '');
        return {
          locataire_id: l.id, nom_locataire: l.nom_locataire, telephone: l.telephone,
          batiment: bat[l.batiment_id], porte: l.numero_porte,
          dette: s.dette, dette_mois: s.dette_mois, loyer: s.loyer,
          whatsapp: tel ? `https://wa.me/${tel.replace(/^\+/, '')}?text=${encodeURIComponent(message)}` : null,
          sms: tel ? `sms:${tel}?body=${encodeURIComponent(message)}` : null,
          message,
        };
      })
      .sort((a, b) => b.dette - a.dette);
    res.json({ mois, relances, total_dette: relances.reduce((s, r) => s + r.dette, 0) });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/relances/:locataireId/envoyer  — envoi direct du rappel via le client
// WhatsApp du serveur (quand il est connecté ; sinon 503 et le lien wa.me reste l'option).
router.post('/:locataireId/envoyer', requireAuth, async (req, res) => {
  const mois = req.body?.mois || moisCourant();
  const id = Number(req.params.locataireId);
  try {
    const { locataires, situations } = await chargerSituations(mois);
    const l = locataires.find((x) => x.id === id);
    if (!l || !situations[id]) return res.status(404).json({ message: 'Locataire introuvable' });
    if (!l.telephone) return res.status(400).json({ message: 'Ce locataire n\'a pas de numéro de téléphone' });
    const r = await wa.envoyerMessage(l.telephone, messageRelance(l, situations[id], mois));
    if (!r.success) return res.status(503).json({ message: r.error || 'WhatsApp non connecté' });
    await journal(null, req, 'relance.envoyee', 'locataire', id,
      { mois, dette: situations[id].dette, simulated: !!r.simulated });
    res.json({ ok: true, simulated: !!r.simulated, delivered: r.delivered !== false });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
