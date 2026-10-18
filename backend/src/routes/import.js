const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseFile } = require('../services/parser-import');
const { recalculerResume } = require('../services/resume');
const { majLoyer, ajouterVersement } = require('../services/loyers');
const { moisCloture } = require('../services/cloture');
const { unitePour } = require('../services/unites');

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
  if (await moisCloture(mois)) {
    return res.status(409).json({ message: `Le mois ${mois} est clôturé : import impossible`, code: 'MOIS_CLOTURE' });
  }
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
          "SELECT id FROM locataires WHERE batiment_id = $1 AND upper(nom_locataire) = upper($2) AND upper(COALESCE(numero_porte,'')) = upper(COALESCE($3,''))",
          [batId, l.nom_locataire, l.numero_porte || null]
        );
        const loyer = Math.round(Number(l.loyer_mensuel) || 0);
        const statut = l.statut === 'Vide' ? 'Vide' : 'Actif';
        // "DOIT N MOIS" du fichier = dette avant le mois importé
        const soldeInitial = Math.round((Number(l.arrieres_initial) || 0) * loyer);
        let locId;
        let actif = statut === 'Actif';
        if (exL.rows[0]) {
          locId = exL.rows[0].id;
          const ex = (await client.query('SELECT * FROM locataires WHERE id = $1', [locId])).rows[0];
          if (!ex.unite_id) {
            await client.query('UPDATE locataires SET unite_id = $1 WHERE id = $2',
              [await unitePour(client, batId, ex.numero_porte, ex.loyer_mensuel), locId]);
          }
          // Seule transition appliquée par l'import : porte vide -> occupée (nouveau compte à partir de ce mois).
          // Un départ se fait avec le bouton « Départ », pas par import.
          const devientOccupe = ex.statut === 'Vide' && statut === 'Actif';
          actif = ex.statut === 'Actif' || devientOccupe;
          await client.query(
            `UPDATE locataires SET loyer_mensuel=$1, note=$2, statut=$3,
               debut_suivi = CASE WHEN $4 THEN $5 ELSE debut_suivi END,
               solde_initial = CASE WHEN $4 THEN $6 ELSE solde_initial END,
               updated_at=CURRENT_TIMESTAMP WHERE id=$7`,
            [loyer, l.note, devientOccupe ? 'Actif' : ex.statut, devientOccupe, mois, soldeInitial, locId]
          );
          if (devientOccupe || loyer !== ex.loyer_mensuel) await majLoyer(client, locId, mois, loyer);
        } else {
          const uniteId = await unitePour(client, batId, l.numero_porte, loyer);
          const insL = await client.query(
            `INSERT INTO locataires (batiment_id, numero_porte, nom_locataire, loyer_mensuel, statut, note, arrieres_initial, debut_suivi, solde_initial, unite_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [batId, l.numero_porte, l.nom_locataire, loyer, statut, l.note, Number(l.arrieres_initial) || 0,
             actif ? mois : null, actif ? soldeInitial : 0, uniteId]
          );
          locId = insL.rows[0].id;
          await majLoyer(client, locId, mois, loyer);
        }
        // Ré-importer le même mois remplace les versements issus de l'import précédent
        await client.query('DELETE FROM versements WHERE locataire_id = $1 AND mois = $2 AND importe', [locId, mois]);
        const montant = Math.round((Number(l.qte_payee_ce_mois) || 0) * loyer);
        if (actif && montant > 0) {
          await ajouterVersement(client, {
            locataire_id: locId, mois, montant, date_versement: `${mois}-01`, importe: true,
            note: 'Import Excel', created_by: req.utilisateur.id,
          });
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
