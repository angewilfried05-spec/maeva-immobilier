// Client API : fetch + JWT stocké en localStorage.
// - Electron : URL fournie par le preload (backend local embarqué ou serveur distant)
// - Navigateur (app servie par le serveur) : même origine
// - Développement Vite : backend local
// Jeton d'accès court + refresh token : un 401 déclenche un renouvellement
// transparent puis une seconde tentative (une seule rotation à la fois).
const API_URL = (typeof window !== 'undefined' && window.env?.API_URL)
  || (import.meta.env.DEV ? 'http://localhost:4001' : '');
// 'local' : Electron + backend sur ce PC ; 'distant' : Electron + serveur ; 'web' : navigateur
export const MODE = (typeof window !== 'undefined' && window.env?.MODE) || 'web';
const TOKEN_KEY = 'maeva_jwt';
const REFRESH_KEY = 'maeva_refresh';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
export function getRefresh() { return localStorage.getItem(REFRESH_KEY); }
export function setSession(res) {
  setToken(res?.token);
  if (res?.refresh_token) localStorage.setItem(REFRESH_KEY, res.refresh_token);
}
export function effacerSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); }

// Une seule rotation en vol : les requêtes concurrentes attendent le même refresh
let rotationEnCours = null;
async function rafraichir() {
  const refresh = getRefresh();
  if (!refresh) return false;
  rotationEnCours ||= fetch(API_URL + '/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  }).then(async (res) => {
    if (!res.ok) return false;
    setSession(await res.json());
    return true;
  }).catch(() => false)
    .finally(() => { rotationEnCours = null; });
  return rotationEnCours;
}

async function envoyer(method, url, { body, formData } = {}, reessaie = true) {
  const headers = {};
  const opts = { method, headers };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (formData) {
    opts.body = formData; // le navigateur met le Content-Type multipart automatiquement
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_URL + url, opts);
  if (res.status === 401 && reessaie && !url.startsWith('/api/v1/auth/') && !url.startsWith('/api/auth/')) {
    if (await rafraichir()) return envoyer(method, url, { body, formData }, false);
  }
  if (res.status === 401) {
    effacerSession();
    throw new AuthError('Session expirée');
  }
  return res;
}

async function erreurDe(res) {
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { /* réponse non JSON */ }
  const err = new Error((data && data.message) || `Erreur ${res.status}`);
  err.status = res.status;
  err.data = data;
  return err;
}

async function request(method, url, options) {
  const res = await envoyer(method, url, options);
  if (!res.ok) throw await erreurDe(res);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Télécharge un fichier renvoyé par l'API (exports, sauvegardes, quittances) et le propose à l'enregistrement
async function telecharger(method, url, body) {
  const res = await envoyer(method, url, { body });
  if (!res.ok) throw await erreurDe(res);
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  const nom = m ? decodeURIComponent(m[1]) : 'fichier';
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(await res.blob());
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
  return nom;
}

// Déconnexion propre : révoque la session côté serveur puis efface localement
async function deconnecter() {
  const refresh = getRefresh();
  if (refresh) {
    try {
      await fetch(API_URL + '/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch { /* hors ligne : l'effacement local suffit */ }
  }
  effacerSession();
}

export class AuthError extends Error {}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, { body: b }),
  put: (u, b) => request('PUT', u, { body: b }),
  del: (u) => request('DELETE', u),
  upload: (u, formData) => request('POST', u, { formData }),
  telecharger,
  login: (username, password) => request('POST', '/api/v1/auth/login', { body: { username, password } }),
  me: () => request('GET', '/api/v1/auth/me'),
  changePassword: (ancien, nouveau) => request('POST', '/api/v1/auth/change-password', { body: { ancien, nouveau } }),
};

export { API_URL, deconnecter };
