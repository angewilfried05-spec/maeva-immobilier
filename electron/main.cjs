const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

let mainWindow;
let splash;
let backendServer;

// Mode distant : l'app se connecte au serveur (données partagées) au lieu du backend local.
// Adresse lue dans MAEVA_SERVEUR, sinon <userData>/config.json, sinon electron/config.json : { "serveur": "https://…" }.
// En développement (npm run dev), backend local sauf si MAEVA_SERVEUR est défini.
function adresseServeur() {
  if (process.env.MAEVA_SERVEUR) return process.env.MAEVA_SERVEUR.replace(/\/+$/, '');
  if (process.env.VITE_DEV_SERVER_URL) return '';
  for (const f of [path.join(app.getPath('userData'), 'config.json'), path.join(__dirname, 'config.json')]) {
    try { return String(JSON.parse(fs.readFileSync(f, 'utf8')).serveur || '').replace(/\/+$/, ''); } catch { /* absent */ }
  }
  return '';
}

const configRenderer = { API_URL: 'http://localhost:4001', MODE: 'local' };
ipcMain.on('config:get', (e) => { e.returnValue = configRenderer; });

function afficherErreur(titre, texte) {
  if (!splash) return;
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html><body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#c0392b;color:#fff;
      display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;border-radius:14px;padding:30px;text-align:center;">
      <div style="font-size:20px;font-weight:700;margin-bottom:12px;">${titre}</div>
      <div style="font-size:14px;color:#fdecea;">${texte}</div>
    </body></html>
  `));
}

const echapper = (s) => String(s).replace(/</g, '&lt;');

function creerSplash(texte) {
  splash = new BrowserWindow({
    width: 480, height: 320, frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, minimizable: false, maximizable: false,
  });
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html><body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#123a68;color:#fff;
      display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;border-radius:14px;">
      <div style="font-size:22px;font-weight:700;margin-bottom:18px;">MAEVA IMMOBILIER</div>
      <div style="font-size:15px;color:#aebbe0;">${texte}</div>
      <div style="margin-top:18px;font-size:24px;">⏳</div>
    </body></html>
  `));
}

function fermerSplash() {
  if (splash) { splash.close(); splash = null; }
}

// Mode local : backend/.env n'est PAS embarqué dans le package (secrets).
// Les secrets sont générés et persistés par machine dans <userData>/desktop-data/.env.
function preparerEnvLocal() {
  const dir = path.join(app.getPath('userData'), 'desktop-data');
  const envPath = path.join(dir, '.env');
  fs.mkdirSync(dir, { recursive: true });
  const vals = {};
  try {
    for (const l of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) vals[m[1]] = m[2];
    }
  } catch { /* premier démarrage */ }
  if (!vals.JWT_SECRET) {
    vals.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
    fs.writeFileSync(envPath,
      Object.entries(vals).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  }
  for (const [k, v] of Object.entries(vals)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

async function demarrerLocal() {
  // Le backend n'est pas embarqué dans les packages distribués (code source privé) :
  // l'installeur fonctionne uniquement en mode distant. En dev, le backend reste
  // présent dans le dépôt et le mode local continue de fonctionner.
  const backendDir = path.join(__dirname, '..', 'backend', 'src');
  if (!fs.existsSync(backendDir)) {
    afficherErreur('Mode local indisponible',
      'Cette version est prévue pour se connecter au serveur MAEVA.<br/><br/>Vérifiez votre connexion Internet puis relancez l\'application.');
    return false;
  }
  // Chargé seulement en mode local : secrets générés par machine (backend/.env non embarqué)
  preparerEnvLocal();
  const { setup: autoSetup } = require('../backend/src/auto-setup');
  const { start: startBackend } = require('../backend/src/server');
  try {
    // 1. Setup automatique (crée la base + migrations + seed si besoin)
    await autoSetup();
  } catch (e) {
    afficherErreur('Impossible de démarrer', `Vérifiez que PostgreSQL est installé et démarré sur ce PC.<br/><br/>${echapper(e.message)}`);
    return false;
  }
  try {
    // 2. Démarrer le backend Express embarqué
    backendServer = await startBackend(4001);
  } catch (e) {
    afficherErreur('Erreur backend', echapper(e.message));
    return false;
  }
  return true;
}

async function verifierServeur(serveur) {
  try {
    const r = await fetch(`${serveur}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`réponse ${r.status}`);
    return true;
  } catch (e) {
    afficherErreur('Serveur injoignable',
      `Impossible de joindre ${echapper(serveur)}.<br/>Vérifiez la connexion Internet puis relancez l'application.<br/><br/>${echapper(e.message)}`);
    return false;
  }
}

async function createWindow() {
  const serveur = adresseServeur();
  if (serveur) {
    creerSplash('Connexion au serveur…');
    if (!(await verifierServeur(serveur))) return;
    Object.assign(configRenderer, { API_URL: serveur, MODE: 'distant' });
  } else {
    creerSplash('Initialisation de la base de données…');
    if (!(await demarrerLocal())) return;
  }

  // 3. Créer la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'MAEVA IMMOBILIER',
    icon: path.join(__dirname, '..', 'assets', 'logo.png'),
    autoHideMenuBar: true,
    show: false, // afficher seulement quand prêt
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    fermerSplash();
    mainWindow.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

ipcMain.handle('shell:ouvrirDossier', (_e, p) => {
  const dossier = p || path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER');
  shell.openPath(dossier);
});

app.on('window-all-closed', () => {
  if (backendServer) backendServer.close();
  app.quit();
});
app.on('before-quit', () => { if (backendServer) backendServer.close(); });
