const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { genererRapport } = require('../services/rapport-mensuel');

const router = express.Router();

// POST /api/export/rapport  (génère le .xlsx au format original)
router.post('/rapport', requireAuth, async (req, res) => {
  const mois = req.body?.mois;
  if (!mois) return res.status(400).json({ message: 'mois requis' });
  try {
    const outDir = path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER', 'rapports');
    const outPath = await genererRapport(mois, outDir);
    res.json({ ok: true, chemin: outPath });
  } catch (e) {
    res.status(500).json({ message: 'Erreur export : ' + e.message });
  }
});

// GET /api/export/dossier  (ouvre le dossier données dans l'OS - géré côté Electron)
router.get('/dossier', requireAuth, (_req, res) => {
  res.json({ dossier: path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER') });
});

module.exports = router;
