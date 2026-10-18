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
app.disable('x-powered-by');

// Derrière Nginx (serveur) : l'IP réelle du client vient de X-Forwarded-For (anti-bruteforce du login)
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

// CORS restreint : Electron (file:// -> origine 'null' ou absente), Vite en dev,
// et les origines listées dans CORS_ORIGINES (ex: https://maeva-immobilier.com). Tout le reste est refusé.
const ORIGINS_AUTORISEES = ['http://localhost:5173', 'http://127.0.0.1:5173',
  ...String(process.env.CORS_ORIGINES || '').split(',').map((o) => o.trim()).filter(Boolean)];
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === 'null' || ORIGINS_AUTORISEES.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  exposedHeaders: ['Content-Disposition'], // nom des fichiers téléchargés (Electron -> serveur distant)
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
app.use('/api', (_req, res) => res.status(404).json({ message: 'Route inconnue' }));

// Mode serveur web : le backend sert aussi le frontend compilé (dist/)
if (process.env.SERVIR_FRONTEND === '1') {
  const dist = path.join(__dirname, '..', '..', 'dist');
  app.use(express.static(dist, { index: false, maxAge: '7d' }));
  app.get('*', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

// Gestion d'erreurs
app.use((err, _req, res, _next) => {
  console.error('Erreur serveur:', err.message);
  res.status(500).json({ message: 'Erreur serveur' });
});

// Démarrage : si lancé directement (node server.js), écoute sur PORT.
// Si requis par Electron, exporte start() qui renvoie une Promise.
function start(port, host) {
  return new Promise((resolve) => {
    const server = app.listen(port || process.env.PORT || 4001, host || process.env.HOST || '127.0.0.1', () => {
      console.log(`✅ Backend MAEVA IMMOBILIER sur ${server.address().address}:${server.address().port}`);
      demarrerSauvegardeAuto();
      resolve(server);
    });
  });
}

if (require.main === module) start();

module.exports = { app, start };
