// Point d'entrée en mode serveur (systemd) : met la base à jour puis démarre l'API + le frontend.
// La configuration vient des variables d'environnement (voir deploy/maeva.env.exemple).
const { setup } = require('./auto-setup');
const { start } = require('./server');

setup()
  .then(() => start())
  .catch((e) => {
    console.error('❌ Démarrage impossible :', e.message);
    process.exit(1);
  });
