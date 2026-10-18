const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { genererRapport } = require('../services/rapport-mensuel');
const { dossierTemporaire, envoyerEtSupprimer } = require('../utils/envoi-fichier');

const router = express.Router();

// POST /api/export/rapport  (télécharge le .xlsx au format original)
router.post('/rapport', requireAuth, async (req, res) => {
  const mois = req.body?.mois;
  if (!mois) return res.status(400).json({ message: 'mois requis' });
  const dossier = dossierTemporaire();
  try {
    envoyerEtSupprimer(res, await genererRapport(mois, dossier), dossier);
  } catch (e) {
    res.status(500).json({ message: 'Erreur export : ' + e.message });
  }
});

module.exports = router;
