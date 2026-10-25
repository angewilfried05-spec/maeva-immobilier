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
const auditRoutes = require('./routes/audit');
const unitesRoutes = require('./routes/unites');
const relancesRoutes = require('./routes/relances');
const whatsappRoutes = require('./routes/whatsapp');
const telechargementsRoutes = require('./routes/telechargements');
const vitrineRoutes = require('./routes/vitrine');
const { demarrerSiConfigure } = require('./services/whatsapp');
const { demarrerSauvegardeAuto } = require('./services/sauvegarde');
const { demarrerNotifications } = require('./services/notifications');

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

// Corps JSON malformé → 400 propre au lieu du 500 générique
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corps de requête JSON invalide', code: 'JSON_INVALIDE' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requête trop volumineuse', code: 'TROP_VOLUMINEUX' });
  }
  return next(err);
});

// Headers de sécurité (complètent ceux posés par Nginx en production)
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  next();
});
// Les réponses d'API ne doivent jamais être mises en cache (données métier)
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'maeva-immobilier', version: '1.0.0' }));

// Contrat d'API v1 (référence pour les clients web / Electron / Android)
// openapi.json n'est servi qu'aux utilisateurs authentifiés : la carte
// complète de l'API ne doit pas être publique.
const { requireAuth } = require('./middleware/auth');
app.get('/api/v1', (_req, res) => res.json({ version: '1', documentation: '/api/v1/openapi.json' }));
app.get('/api/v1/openapi.json', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'openapi.json')));
app.use('/api/v1/audit', auditRoutes);

// Vocabulaire v1 : les lignes « locataires » de la base sont les contrats
// d'occupation — /api/v1/contrats expose donc le même router.
app.use('/api/v1/contrats', locatairesRoutes);

// Toutes les ressources existent sous /api (clients actuels) et /api/v1 (contrat stable).
const ROUTES = [
  ['/auth', authRoutes],
  ['/utilisateurs', utilisateursRoutes],
  ['/batiments', batimentsRoutes],
  ['/unites', unitesRoutes],
  ['/locataires', locatairesRoutes],
  ['/relances', relancesRoutes],
  ['/versements', versementsRoutes],
  ['/depenses', depensesRoutes],
  ['/resumes', resumesRoutes],
  ['/dashboard', dashboardRoutes],
  ['/import', importRoutes],
  ['/export', exportRoutes],
  ['/devis', devisRoutes],
  ['/catalogue', catalogueRoutes],
  ['/sauvegardes', sauvegardesRoutes],
  ['/whatsapp', whatsappRoutes],
  ['/telechargements', telechargementsRoutes],
  ['/vitrine', vitrineRoutes],
];
for (const [chemin, r] of ROUTES) {
  app.use('/api' + chemin, r);
  app.use('/api/v1' + chemin, r);
}
app.use('/api', (_req, res) => res.status(404).json({ message: 'Route inconnue', code: 'INCONNUE' }));

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
      demarrerSiConfigure();
      demarrerNotifications();
      resolve(server);
    });
  });
}

if (require.main === module) start();

module.exports = { app, start };
