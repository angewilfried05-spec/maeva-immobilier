const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { setup: autoSetup } = require('../backend/src/auto-setup');
const { start: startBackend } = require('../backend/src/server');

let mainWindow;
let splash;
let backendServer;

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

async function createWindow() {
  creerSplash('Initialisation de la base de données…');

  // 1. Setup automatique (crée la base + migrations + seed si besoin)
  try {
    await autoSetup();
  } catch (e) {
    if (splash) {
      splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <html><body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#c0392b;color:#fff;
          display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;border-radius:14px;padding:30px;text-align:center;">
          <div style="font-size:20px;font-weight:700;margin-bottom:12px;">Impossible de démarrer</div>
          <div style="font-size:14px;color:#fdecea;">Vérifiez que PostgreSQL est installé et démarré sur ce PC.<br/><br/>${String(e.message).replace(/</g, '&lt;')}</div>
        </body></html>
      `));
    }
    return;
  }

  // 2. Démarrer le backend Express embarqué
  try {
    backendServer = await startBackend(4001);
  } catch (e) {
    fermerSplash();
    const errWin = new BrowserWindow({ width: 500, height: 300 });
    errWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      `<html><body style="font-family:Arial;padding:30px;"><h2>Erreur backend</h2><p>${String(e.message).replace(/</g,'&lt;')}</p></body></html>`
    ));
    return;
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
