const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseFile } = require('../services/parser-import');
const { recalculerResume } = require('../services/resume');

const router = express.Router();
const upload = multer({ dest: path.join(os.tmpdir(), 'maeva-import') });

// GET /api/import/fichier-embarque  (sert le fichier Excel exemple embarqué dans assets/)
router.get('/fichier-embarque', requireAuth, (_req, res) => {
  const fichierEmbarque = path.join(__dirname, '..', '..', '..', 'assets', 'LOYER_AOUT_2026_EXEMPLE.xlsx');
  if (!fs.existsSync(fichierEmbarque)) {
    return res.status(404).json({ message: 'Fichier exemple introuvable' });
  }
  res.download(fichierEmbarque, 'LOYER_AOUT_2026_EXEMPLE.xlsx');
});

// POST /api/import/preview  (upload du fichier -> aperçu)
router.post('/preview', requireAuth, requireRole('admin', 'gerant'), upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });
  try {
    const apercu = await parseFile(req.file.path);
    res.json(apercu);
  } catch (e) {
    res.status(400).json({ message: 'Lecture impossible : ' + e.message });
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

// POST /api/import/commit  (valide l'aperçu éventuellement modifié)
router.post('/commit', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const apercu = req.body;
  const { mois, batiments, depenses, remis_au_boss } = apercu;
  if (!mois || !Array.isArray(batiments)) return res.status(400).json({ message: 'Aperçu invalide' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const b of batiments) {
      let batId;
      const ex = await client.query('SELECT id FROM batiments WHERE upper(nom) = upper($1)', [b.nom]);
      if (ex.rows[0]) batId = ex.rows[0].id;
      else {
        const ins = await client.query(
          'INSERT INTO batiments (nom) VALUES ($1) RETURNING id', [b.nom]
        );
        batId = ins.rows[0].id;
      }
      for (const l of b.locataires) {
        const exL = await client.query(
          'SELECT id FROM locataires WHERE batiment_id = $1 AND upper(nom_locataire) = upper($2) AND COALESCE(numero_porte,$3) = COALESCE(numero_porte,$3)',
          [batId, l.nom_locataire, l.numero_porte || null]
        );
        let locId;
        if (exL.rows[0]) {
          locId = exL.rows[0].id;
          await client.query(
            `UPDATE locataires SET loyer_mensuel=$1, statut=$2, note=$3, arrieres_initial=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
            [l.loyer_mensuel, l.statut, l.note, l.arrieres_initial || 0, locId]
          );
        } else {
          const insL = await client.query(
            `INSERT INTO locataires (batiment_id, numero_porte, nom_locataire, loyer_mensuel, statut, note, arrieres_initial)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [batId, l.numero_porte, l.nom_locataire, l.loyer_mensuel, l.statut, l.note, l.arrieres_initial || 0]
          );
          locId = insL.rows[0].id;
        }
        if (Number(l.qte_payee_ce_mois) > 0) {
          const total = Math.round(Number(l.qte_payee_ce_mois) * Number(l.loyer_mensuel));
          await client.query(
            `INSERT INTO paiements (locataire_id, mois, quantite_mois_payee, montant_unitaire, montant_total_paye, date_paiement)
             VALUES ($1,$2,$3,$4,$5,CURRENT_DATE)
             ON CONFLICT (locataire_id, mois) DO UPDATE SET
               quantite_mois_payee = EXCLUDED.quantite_mois_payee,
               montant_unitaire = EXCLUDED.montant_unitaire,
               montant_total_paye = EXCLUDED.montant_total_paye`,
            [locId, mois, Number(l.qte_payee_ce_mois), Number(l.loyer_mensuel), total]
          );
        }
      }
    }
    for (const d of depenses || []) {
      const exD = await client.query(
        'SELECT id FROM depenses WHERE mois = $1 AND upper(designation) = upper($2)', [mois, d.designation]
      );
      if (!exD.rows[0]) {
        await client.query(
          `INSERT INTO depenses (mois, designation, categorie, quantite, montant_unitaire, montant_total, beneficiaire, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [mois, d.designation, d.categorie, Number(d.quantite) || 0, Number(d.montant_unitaire) || 0,
           Math.round((Number(d.quantite) || 0) * (Number(d.montant_unitaire) || 0)), null, null]
        );
      }
    }
    await client.query('COMMIT');
    await recalculerResume(mois);
    if (remis_au_boss) {
      await pool.query(
        `UPDATE resumes SET montant_remis_au_proprietaire = $1 WHERE mois = $2`,
        [Number(remis_au_boss), mois]
      );
    }
    res.json({ ok: true, mois });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: "Erreur d'import : " + e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
