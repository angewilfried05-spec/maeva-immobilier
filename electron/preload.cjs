const { contextBridge, ipcRenderer } = require('electron');

// L'URL du backend embarqué est injectée dans le renderer.
// Le frontend utilise fetch() avec JWT pour parler au backend.
contextBridge.exposeInMainWorld('env', {
  API_URL: 'http://localhost:4001',
});

// Quelques actions Electron qui ne passent pas par HTTP (ouverture de dossier, dialogue fichier)
contextBridge.exposeInMainWorld('electron', {
  ouvrirDossier: (p) => ipcRenderer.invoke('shell:ouvrirDossier', p),
  choisirFichier: () => ipcRenderer.invoke('dialog:choisirFichier'),
});

ipcRenderer.on('api-url', (_e, url) => {
  // Permet à main de pousser l'URL effective si besoin
  window.__API_URL__ = url;
});
