// Restaure une sauvegarde JSON en ligne de commande (ex : transfert des données vers le serveur).
// Usage : node src/restaurer-cli.js <fichier.json>
// Une sauvegarde de sécurité de l'état actuel est créée avant.
const fs = require('fs');
const pool = require('./config/db');
const { restaurer } = require('./services/sauvegarde');

const fichier = process.argv[2];
if (!fichier) {
  console.error('Usage : node src/restaurer-cli.js <fichier.json>');
  process.exit(1);
}

restaurer(JSON.parse(fs.readFileSync(fichier, 'utf8')))
  .then((r) => {
    console.log('✅ Restauration terminée :', JSON.stringify(r.compte));
    console.log('   Sauvegarde de sécurité :', r.sauvegarde_securite);
    return pool.end();
  })
  .catch((e) => {
    console.error('❌ Restauration impossible :', e.message);
    process.exit(1);
  });
