const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { journal } = require('../services/journal');
const wa = require('../services/whatsapp');

const router = express.Router();
const ADMIN = requireRole('admin');

// GET /api/whatsapp/status — état du client (CONNECTED / QRCODE / DISCONNECTED / SIMULATION)
router.get('/status', requireAuth, ADMIN, (_req, res) => {
  res.json(wa.statut());
});

// POST /api/whatsapp/qr — démarre le client et renvoie le QR (data URL) à scanner
router.post('/qr', requireAuth, ADMIN, async (req, res) => {
  res.json(await wa.demanderQr());
});

// POST /api/whatsapp/relink — réinitialise la session et régénère un QR
router.post('/relink', requireAuth, ADMIN, async (req, res) => {
  await journal(null, req, 'whatsapp.relier', 'whatsapp', null);
  res.json(await wa.relier());
});

// POST /api/whatsapp/logout — déconnecte le client et efface la session
router.post('/logout', requireAuth, ADMIN, async (req, res) => {
  await journal(null, req, 'whatsapp.deconnexion', 'whatsapp', null);
  res.json(await wa.deconnexion());
});

// POST /api/whatsapp/test-send { telephone, message } — envoi de test
router.post('/test-send', requireAuth, ADMIN, async (req, res) => {
  const telephone = String(req.body?.telephone || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!telephone || !message) return res.status(400).json({ message: 'Numéro et message requis' });
  const r = await wa.envoyerMessage(telephone, message);
  if (!r.success) return res.status(400).json({ message: r.error || 'Envoi impossible' });
  await journal(null, req, 'whatsapp.envoi_test', 'whatsapp', null, { telephone });
  res.json({ ok: true, simulated: !!r.simulated, delivered: r.delivered !== false });
});

// POST /api/whatsapp/relances — lance immédiatement la tournée de relances du mois
router.post('/relances', requireAuth, ADMIN, async (req, res) => {
  try {
    const { envoyerRelancesDuJour } = require('../services/notifications');
    const r = await envoyerRelancesDuJour();
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
