const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { chargerSituations, moisCourant } = require('../services/situation');

const router = express.Router();

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const moisFr = (m) => { const [a, mm] = m.split('-'); return `${MOIS_FR[Number(mm) - 1]} ${a}`; };
const NUM_FMT = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
        const message = `Bonjour ${l.nom_locataire}, sauf erreur de notre part, votre loyer `
          + `présente un solde de ${NUM_FMT(s.dette)} FCFA (${s.dette_mois} mois) à ${moisFr(mois)}. `
          + `Merci de régulariser. — MAEVA IMMOBILIER`;
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

module.exports = router;
