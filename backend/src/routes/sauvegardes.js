const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { dossierSauvegardes, listerSauvegardes, creerSauvegarde, restaurer } = require('../services/sauvegarde');

const router = express.Router();
const upload = multer({ dest: path.join(os.tmpdir(), 'maeva-restauration'), limits: { fileSize: 200 * 1024 * 1024 } });
const NOM_VALIDE = /^[\w-]+\.json$/;

router.use(requireAuth, requireRole('admin'));

// GET /api/sauvegardes
router.get('/', (_req, res) => {
  try { res.json({ dossier: dossierSauvegardes(), sauvegardes: listerSauvegardes() }); }
  catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// POST /api/sauvegardes  (sauvegarde manuelle immédiate)
router.post('/', async (_req, res) => {
  try { res.status(201).json(await creerSauvegarde('manuel')); }
  catch (e) { res.status(500).json({ message: 'Échec de la sauvegarde : ' + e.message }); }
});

// POST /api/sauvegardes/restaurer  { nom }  (fichier du dossier des sauvegardes)
router.post('/restaurer', async (req, res) => {
  const nom = String(req.body?.nom || '');
  if (!NOM_VALIDE.test(nom)) return res.status(400).json({ message: 'Nom de sauvegarde invalide' });
  const fichier = path.join(dossierSauvegardes(), nom);
  if (!fs.existsSync(fichier)) return res.status(404).json({ message: 'Sauvegarde introuvable' });
  try { res.json(await restaurer(JSON.parse(fs.readFileSync(fichier, 'utf8')))); }
  catch (e) { res.status(400).json({ message: 'Restauration impossible : ' + e.message }); }
});

// POST /api/sauvegardes/restaurer-fichier  (fichier .json choisi par l'utilisateur, ex. clé USB)
router.post('/restaurer-fichier', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });
  try { res.json(await restaurer(JSON.parse(fs.readFileSync(req.file.path, 'utf8')))); }
  catch (e) { res.status(400).json({ message: 'Restauration impossible : ' + e.message }); }
  finally { try { fs.unlinkSync(req.file.path); } catch {} }
});

module.exports = router;
