const { contextBridge, ipcRenderer } = require('electron');

// Adresse de l'API (backend local embarqué ou serveur distant) et mode, fournis par le process principal.
// Le frontend utilise fetch() avec JWT pour parler au backend.
const config = ipcRenderer.sendSync('config:get');
contextBridge.exposeInMainWorld('env', { API_URL: config.API_URL, MODE: config.MODE });

// Actions Electron qui ne passent pas par HTTP
contextBridge.exposeInMainWorld('electron', {
  ouvrirDossier: (p) => ipcRenderer.invoke('shell:ouvrirDossier', p),
});
