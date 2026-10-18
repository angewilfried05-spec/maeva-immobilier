const express = require('express');
const fs = require('fs');
const path = require('path');

// Distribution des applications (APK Android + installeur Windows).
// Dossier lu depuis TELECHARGEMENTS_DIR, sinon <projet>/telechargements.
// Sur le serveur : /opt/maeva/telechargements (persiste entre les releases).
const router = express.Router();
const DIR = process.env.TELECHARGEMENTS_DIR
  || path.join(__dirname, '..', '..', 'telechargements');

const FICHIERS = {
  android: {
    local: 'maeva-android.apk',
    nom: 'MAEVA-Immobilier.apk',
    type: 'application/vnd.android.package-archive',
    libelle: 'Application Android (APK)',
  },
  windows: {
    local: 'maeva-windows.exe',
    nom: 'MAEVA-Immobilier-Setup.exe',
    type: 'application/octet-stream',
    libelle: 'Application Windows (Electron)',
  },
};

// Liste des applications disponibles (public — ce sont des installateurs)
router.get('/', (_req, res) => {
  const dispo = {};
  for (const [cle, f] of Object.entries(FICHIERS)) {
    const p = path.join(DIR, f.local);
    dispo[cle] = fs.existsSync(p)
      ? { disponible: true, taille: fs.statSync(p).size, libelle: f.libelle, url: `/api/telechargements/${cle}` }
      : { disponible: false, libelle: f.libelle };
  }
  res.json(dispo);
});

router.get('/:plateforme', (req, res) => {
  const f = FICHIERS[req.params.plateforme];
  if (!f) return res.status(404).json({ message: 'Téléchargement inconnu' });
  const p = path.join(DIR, f.local);
  if (!fs.existsSync(p)) {
    return res.status(404).json({ message: 'Fichier pas encore publié sur ce serveur' });
  }
  res.setHeader('Content-Type', f.type);
  res.setHeader('Content-Disposition', `attachment; filename="${f.nom}"`);
  fs.createReadStream(p).pipe(res);
});

module.exports = router;
