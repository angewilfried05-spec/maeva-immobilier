const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const utilisateursRoutes = require('./routes/utilisateurs');
const batimentsRoutes = require('./routes/batiments');
const locatairesRoutes = require('./routes/locataires');
const versementsRoutes = require('./routes/versements');
const depensesRoutes = require('./routes/depenses');
const resumesRoutes = require('./routes/resumes');
const dashboardRoutes = require('./routes/dashboard');
const importRoutes = require('./routes/import');
const exportRoutes = require('./routes/export');
const devisRoutes = require('./routes/devis');
const catalogueRoutes = require('./routes/catalogue');
const sauvegardesRoutes = require('./routes/sauvegardes');
const { demarrerSauvegardeAuto } = require('./services/sauvegarde');

const app = express();

// CORS restreint : le front est servi par Electron (file:// -> aucune origine)
// ou par le serveur Vite en dev. Tout le reste est refusé.
const ORIGINS_AUTORISEES = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === 'null' || ORIGINS_AUTORISEES.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'maeva-immobilier', version: '1.0.0' }));

app.use('/api/auth', authRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);
app.use('/api/batiments', batimentsRoutes);
app.use('/api/locataires', locatairesRoutes);
app.use('/api/versements', versementsRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api/resumes', resumesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/sauvegardes', sauvegardesRoutes);

// Gestion d'erreurs
app.use((err, _req, res, _next) => {
  console.error('Erreur serveur:', err.message);
  res.status(500).json({ message: 'Erreur serveur' });
});

// Démarrage : si lancé directement (node server.js), écoute sur PORT.
// Si requis par Electron, exporte start() qui renvoie une Promise.
function start(port) {
  return new Promise((resolve) => {
    const server = app.listen(port || process.env.PORT || 4001, () => {
      console.log(`✅ Backend MAEVA IMMOBILIER sur le port ${server.address().port}`);
      demarrerSauvegardeAuto();
      resolve(server);
    });
  });
}

if (require.main === module) start();

module.exports = { app, start };
