const fs = require('fs');
const os = require('os');
const path = require('path');

// Dossier temporaire unique pour générer un fichier à envoyer au client
function dossierTemporaire() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maeva-export-'));
}

// Envoie le fichier en téléchargement puis supprime le dossier temporaire
function envoyerEtSupprimer(res, fichier, dossier) {
  res.download(fichier, path.basename(fichier), (err) => {
    fs.rm(dossier, { recursive: true, force: true }, () => {});
    if (err && !res.headersSent) res.status(500).json({ message: 'Envoi du fichier impossible' });
  });
}

module.exports = { dossierTemporaire, envoyerEtSupprimer };
