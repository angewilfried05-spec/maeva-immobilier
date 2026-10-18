const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recalculerResume } = require('../services/resume');
const { MOIS_VALIDE, ajouterVersement } = require('../services/loyers');
const { texteOuNull } = require('../utils/fusion');

const router = express.Router();
const SAISIE = requireRole('admin', 'gerant', 'comptable');

// GET /api/versements?mois=&locataire_id=
router.get('/', requireAuth, async (req, res) => {
  const { mois, locataire_id } = req.query;
  try {
    const params = [];
    const where = [];
    if (mois) { params.push(mois); where.push(`mois = $${params.length}`); }
    if (locataire_id) { params.push(Number(locataire_id)); where.push(`locataire_id = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT * FROM versements${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY mois DESC, date_versement, id`, params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/versements  { locataire_id, mois, montant, date_versement?, mode?, note? }
router.post('/', requireAuth, SAISIE, async (req, res) => {
  const { locataire_id, mois, montant, date_versement, mode, note } = req.body || {};
  const m = Math.round(Number(montant));
  if (!locataire_id || !MOIS_VALIDE.test(String(mois || ''))) return res.status(400).json({ message: 'Locataire et mois requis' });
  if (!(m > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0' });
  try {
    const loc = await pool.query('SELECT statut FROM locataires WHERE id = $1', [Number(locataire_id)]);
    if (!loc.rows[0]) return res.status(404).json({ message: 'Locataire introuvable' });
    if (loc.rows[0].statut === 'Vide') return res.status(400).json({ message: 'Porte vide : aucun loyer à encaisser' });
    const v = await ajouterVersement(pool, {
      locataire_id: Number(locataire_id), mois, montant: m, date_versement, mode,
      note: texteOuNull(note), created_by: req.utilisateur.id,
    });
    await recalculerResume(mois);
    res.status(201).json(v);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur: ' + e.message }); }
});

// PUT /api/versements/note  { locataire_id, mois, note }  (note du mois ; vide = supprimée)
router.put('/note', requireAuth, SAISIE, async (req, res) => {
  const { locataire_id, mois } = req.body || {};
  const note = texteOuNull(req.body?.note);
  if (!locataire_id || !MOIS_VALIDE.test(String(mois || ''))) return res.status(400).json({ message: 'Locataire et mois requis' });
  try {
    if (note) {
      await pool.query(
        `INSERT INTO notes_loyers (locataire_id, mois, note) VALUES ($1, $2, $3)
         ON CONFLICT (locataire_id, mois) DO UPDATE SET note = EXCLUDED.note`, [Number(locataire_id), mois, note]
      );
    } else {
      await pool.query('DELETE FROM notes_loyers WHERE locataire_id = $1 AND mois = $2', [Number(locataire_id), mois]);
    }
    res.json({ ok: true, note });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/versements/:id
router.delete('/:id', requireAuth, SAISIE, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM versements WHERE id = $1 RETURNING mois', [Number(req.params.id)]);
    if (!r.rows[0]) return res.status(404).json({ message: 'Versement introuvable' });
    await recalculerResume(r.rows[0].mois);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
