// Client API : fetch + JWT stocké en localStorage.
const API_URL = (typeof window !== 'undefined' && window.env?.API_URL) || 'http://localhost:4001';
const TOKEN_KEY = 'maeva_jwt';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

async function request(method, url, { body, formData, isJson = true } = {}) {
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
  if (res.status === 401) {
    setToken(null);
    throw new AuthError('Session expirée');
  }
  const txt = await res.text();
  const data = txt ? (isJson ? JSON.parse(txt) : txt) : null;
  if (!res.ok) {
    const msg = (data && data.message) || `Erreur ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export class AuthError extends Error {}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, { body: b }),
  put: (u, b) => request('PUT', u, { body: b }),
  del: (u) => request('DELETE', u),
  upload: (u, formData) => request('POST', u, { formData }),
  login: (username, password) => request('POST', '/api/auth/login', { body: { username, password } }),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (ancien, nouveau) => request('POST', '/api/auth/change-password', { body: { ancien, nouveau } }),
};

export { API_URL };
