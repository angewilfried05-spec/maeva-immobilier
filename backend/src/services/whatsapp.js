// Service WhatsApp Web (client local) — adapté de gestion_incidents/whatsappService.js.
// Envoi de messages et de documents (quittances PDF) via WhatsApp Web.
// Si whatsapp-web.js n'est pas installé (dépendance optionnelle), le service
// fonctionne en mode simulation : les envois sont journalisés, rien n'est envoyé.

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

let Client = null;
let LocalAuth = null;
let MessageMedia = null;
let QRCode = null;
let disponible = false;

try {
  const wwebjs = require('whatsapp-web.js');
  Client = wwebjs.Client;
  LocalAuth = wwebjs.LocalAuth;
  MessageMedia = wwebjs.MessageMedia;
  disponible = true;
} catch {
  console.log('[WhatsApp] whatsapp-web.js non installé — mode simulation (envois journalisés uniquement)');
}
try { QRCode = require('qrcode'); } catch {}

let client = null;
let readyPromise = null;
let isInitializing = false;
let isReady = false;
let latestQr = null;
let latestQrDataUrl = null;
let lastError = null;

const MODE = (process.env.WHATSAPP_MODE || 'local').toLowerCase();
const authDataPath = path.resolve(
  process.env.WHATSAPP_AUTH_DIR || path.join(__dirname, '..', '..', '.wwebjs_auth')
);
const cacheDataPath = path.resolve(
  process.env.WHATSAPP_CACHE_DIR || path.join(__dirname, '..', '..', '.wwebjs_cache')
);

let fileEnvoi = Promise.resolve();

// En-tête ajouté au-dessus de tous les messages sortants
const ENTETE = process.env.WHATSAPP_MESSAGE_HEADER
  ? process.env.WHATSAPP_MESSAGE_HEADER + '\n───────────────\n\n'
  : '🏠 *MAEVA IMMOBILIER*\n───────────────\n\n';

function avecEntete(message) {
  if (!message) return message;
  if (message.startsWith(ENTETE)) return message;
  return ENTETE + message;
}

// Normalise un numéro vers le format international sans '+' (défaut : Côte d'Ivoire 225)
function normaliserNumero(to) {
  if (!to) return null;
  let n = String(to).replace(/[^\d]/g, '');
  // Numéro national ivoirien : 10 chiffres commençant par 0
  if (n.length === 10 && n.startsWith('0')) n = (process.env.WHATSAPP_INDICATIF || '225') + n;
  return n || null;
}

function creerClient() {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--no-first-run', '--no-zygote'];
  if (process.env.WHATSAPP_DISABLE_AUTOMATION_FLAG !== 'false') {
    args.push('--disable-blink-features=AutomationControlled');
  }
  const puppeteer = {
    headless: process.env.WHATSAPP_HEADLESS !== 'false',
    args,
  };
  if (process.env.WHATSAPP_CHROME_PATH && fsSync.existsSync(process.env.WHATSAPP_CHROME_PATH)) {
    puppeteer.executablePath = process.env.WHATSAPP_CHROME_PATH;
  }

  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: authDataPath }),
    webVersionCache: { type: 'local', path: cacheDataPath },
    puppeteer,
  });

  c.on('qr', async (qr) => {
    latestQr = qr;
    latestQrDataUrl = null;
    if (QRCode) {
      try {
        latestQrDataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, width: 260 });
      } catch {}
    }
    isReady = false;
    lastError = null;
    console.log('[WhatsApp] QR code disponible — à scanner depuis l\'app WhatsApp');
  });

  c.on('ready', () => {
    console.log('[WhatsApp] Client prêt — envois réels actifs');
    isReady = true;
    latestQr = null;
    latestQrDataUrl = null;
    lastError = null;
  });

  c.on('auth_failure', (msg) => {
    console.error('[WhatsApp] auth_failure:', msg);
    lastError = String(msg || 'auth_failure');
    resetClient().catch(() => {});
  });

  c.on('disconnected', (reason) => {
    console.error('[WhatsApp] disconnected:', reason);
    lastError = String(reason || 'disconnected');
    resetClient().catch(() => {});
  });

  c.on('change_state', (state) => {
    if (['TIMEOUT', 'CONFLICT', 'UNPAIRED', 'UNLAUNCHED'].includes(state)) {
      console.error('[WhatsApp] État dégradé :', state);
      lastError = String(state);
      resetClient().catch(() => {});
    }
  });

  return c;
}

async function initClientSiBesoin() {
  if (!disponible || MODE === 'simulation') {
    return { client: null, readyPromise: Promise.resolve(false) };
  }
  if ((client && readyPromise) || isInitializing) return { client, readyPromise };
  isInitializing = true;

  client = creerClient();
  readyPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WhatsApp ready timeout')), 240000);
    client.once('ready', () => { clearTimeout(timeout); resolve(true); });
    client.once('auth_failure', () => { clearTimeout(timeout); reject(new Error('WhatsApp auth_failure')); });
    client.once('disconnected', () => { clearTimeout(timeout); reject(new Error('WhatsApp disconnected')); });
  });
  readyPromise.catch((err) => {
    lastError = err.message;
    resetClient().catch(() => {});
    return false;
  });

  try {
    await client.initialize();
  } catch (err) {
    const msg = String(err?.message || err);
    // Navigateur orphelin qui garde le profil verrouillé : nettoyage puis une seconde chance.
    if (/already running/i.test(msg)) {
      await resetClient();
      await fs.rm(path.join(authDataPath, 'session', 'lockfile'), { force: true }).catch(() => {});
      isInitializing = false;
      return initClientSiBesoin();
    }
    await resetClient();
    lastError = msg;
    throw err;
  } finally {
    isInitializing = false;
  }
  return { client, readyPromise };
}

async function resetClient() {
  if (!client) return;
  const ancien = client;
  client = null;
  readyPromise = null;
  isInitializing = false;
  isReady = false;
  latestQr = null;
  latestQrDataUrl = null;
  try {
    await Promise.race([
      ancien.destroy(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('destroy timeout')), 5000)),
    ]);
  } catch {
    try {
      if (ancien.pupBrowser?.process?.kill) ancien.pupBrowser.process.kill();
    } catch {}
  }
}

function statut() {
  if (!disponible || MODE === 'simulation') {
    return { ready: false, connected: false, qr: null, qrCodeData: null,
      status: disponible ? 'SIMULATION' : 'UNAVAILABLE',
      lastError: disponible ? 'Mode simulation (WHATSAPP_MODE)' : 'whatsapp-web.js non installé',
      account: null };
  }
  const info = client?.info || null;
  const pret = !!client && isReady;
  return {
    ready: pret,
    initializing: !!isInitializing,
    connected: pret,
    qrAvailable: !!latestQr,
    qrCodeData: client ? latestQrDataUrl : null,
    status: pret ? 'CONNECTED' : client ? (latestQr ? 'QRCODE' : 'INITIALIZING') : 'DISCONNECTED',
    lastError: pret ? null : lastError,
    account: info ? { pushname: info.pushname || '', wid: info.wid?._serialized || '' } : null,
  };
}

async function deconnexion() {
  const courant = client;
  client = null;
  readyPromise = null;
  isInitializing = false;
  isReady = false;
  latestQr = null;
  latestQrDataUrl = null;
  if (courant) {
    try { await courant.logout(); } catch {}
    try { await courant.destroy(); } catch {}
  }
  await fs.rm(authDataPath, { recursive: true, force: true }).catch(() => {});
  lastError = null;
  return statut();
}

async function demanderQr() {
  try { await initClientSiBesoin(); } catch (err) { lastError = err.message; }
  return statut();
}

async function relier() {
  await deconnexion();
  try { await initClientSiBesoin(); } catch (err) { lastError = err.message; }
  return statut();
}

// Contournement de la migration LID de WhatsApp (envoi vers <numéro>@c.us).
async function contournerLid(waClient) {
  try {
    const page = waClient?.pupPage;
    if (!page) return;
    await page.evaluate(() => {
      try {
        window.injectToFunction({ module: 'WAWebLid1X1MigrationGating', function: 'Lid1X1MigrationUtils.isLidMigrated' }, () => false);
      } catch {}
      try {
        window.injectToFunction({ module: 'WAWebLid1X1MigrationGating', function: 'shouldHaveAccountLid' }, () => false);
      } catch {}
    });
  } catch {}
}

// Attend la confirmation de distribution (ack >= 2) d'un message envoyé.
function attendreDistribution(waClient, sentMessage, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const sentId = sentMessage?.id?._serialized;
    if (!sentId) return resolve(false);
    if ((sentMessage.ack ?? 0) >= 2) return resolve(true);
    let timer;
    const onAck = (ackMsg, ack) => {
      if (ackMsg?.id?._serialized !== sentId) return;
      if (ack >= 2) {
        clearTimeout(timer);
        waClient.removeListener('message_ack', onAck);
        resolve(true);
      }
    };
    timer = setTimeout(() => {
      waClient.removeListener('message_ack', onAck);
      resolve(false);
    }, timeoutMs);
    waClient.on('message_ack', onAck);
  });
}

async function resoudreDestinataire(waClient, numero) {
  const numberId = await waClient.getNumberId(numero);
  return numberId ? numberId._serialized : null;
}

/**
 * Envoie un message WhatsApp. La file sérialise les envois (un client = un envoi à la fois).
 */
async function envoyerMessage(to, message) {
  const texte = avecEntete(String(message || ''));
  if (!disponible || MODE === 'simulation') {
    console.log(`[WhatsApp] Message simulé vers ${to}: ${texte.split('\n')[0]}…`);
    return { success: true, simulated: true };
  }

  const run = async () => {
    const { client: waClient, readyPromise: waReady } = await initClientSiBesoin();
    await waReady;
    if (!client || !isReady || !client.info || waClient !== client) {
      throw new Error('WhatsApp client not ready');
    }
    const numero = normaliserNumero(to);
    if (!numero) return { success: false, error: 'Aucun destinataire' };

    const resolvedId = await resoudreDestinataire(waClient, numero);
    if (!resolvedId) return { success: false, error: 'Numéro non WhatsApp' };

    await contournerLid(waClient);
    let envoye;
    try {
      envoye = await waClient.sendMessage(`${numero}@c.us`, texte);
    } catch {
      // Renvoi uniquement si l'envoi lui-même a échoué — jamais sur un
      // délai d'accusé (renvoyer ici créerait un doublon).
      envoye = await waClient.sendMessage(resolvedId, texte);
    }
    const distribue = await attendreDistribution(waClient, envoye);
    return { success: true, delivered: distribue };
  };

  fileEnvoi = fileEnvoi.then(run, run);
  try {
    return await fileEnvoi;
  } catch (err) {
    const msg = String(err?.message || err);
    if (/not ready|closed|target|detached|protocol|unlaunched|unpaired|conflict|disconnected|initialize|auth_failure/i.test(msg)) {
      await resetClient();
    }
    return { success: false, error: msg };
  }
}

/**
 * Envoie un document (PDF de quittance, etc.) avec une légende optionnelle.
 */
async function envoyerDocument(to, fichier, legende = '') {
  const caption = avecEntete(legende || '');
  if (!disponible || MODE === 'simulation' || !MessageMedia) {
    console.log(`[WhatsApp] Document simulé vers ${to}: ${fichier}`);
    return { success: true, simulated: true };
  }

  const run = async () => {
    const { client: waClient, readyPromise: waReady } = await initClientSiBesoin();
    await waReady;
    if (!client || !isReady || !client.info || waClient !== client) {
      throw new Error('WhatsApp client not ready');
    }
    const numero = normaliserNumero(to);
    if (!numero) return { success: false, error: 'Aucun destinataire' };
    const resolvedId = await resoudreDestinataire(waClient, numero);
    if (!resolvedId) return { success: false, error: 'Numéro non WhatsApp' };
    const media = MessageMedia.fromFilePath(fichier);
    await contournerLid(waClient);
    let envoye;
    try {
      envoye = await waClient.sendMessage(`${numero}@c.us`, media, { caption });
    } catch {
      // Renvoi uniquement si l'envoi lui-même a échoué — jamais sur un
      // délai d'accusé (les acks médias arrivent tard ou pas du tout :
      // renvoyer ici créerait un doublon).
      envoye = await waClient.sendMessage(resolvedId, media, { caption });
    }
    const distribue = await attendreDistribution(waClient, envoye);
    return { success: true, delivered: distribue };
  };

  fileEnvoi = fileEnvoi.then(run, run);
  try {
    return await fileEnvoi;
  } catch (err) {
    const msg = String(err?.message || err);
    if (/not ready|closed|target|detached|protocol|unlaunched|unpaired|conflict|disconnected|initialize|auth_failure/i.test(msg)) {
      await resetClient();
    }
    return { success: false, error: msg };
  }
}

/** Démarre le client au boot si WHATSAPP_AUTO_START=1 (la session LocalAuth est persistée). */
async function demarrerSiConfigure() {
  if (process.env.WHATSAPP_AUTO_START !== '1' || !disponible || MODE === 'simulation') return;
  try {
    await initClientSiBesoin();
  } catch (err) {
    console.error('[WhatsApp] Démarrage auto échoué :', err.message);
  }
}

module.exports = {
  envoyerMessage,
  envoyerDocument,
  statut,
  demanderQr,
  relier,
  deconnexion,
  demarrerSiConfigure,
  estPret: () => !!client && isReady,
};
