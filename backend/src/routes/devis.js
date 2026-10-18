const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { genererDevisDocx, genererDevisPdf } = require('../services/generer-devis');

const router = express.Router();

// Génère le prochain numéro de devis au format N°XXXX/MAEVA IM/XXX
async function prochainNumero() {
  const annee = new Date().getFullYear();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO devis_compteur (annee, numero) VALUES ($1, 0) ON CONFLICT (annee) DO NOTHING', [annee]
    );
    const { rows } = await client.query(
      'UPDATE devis_compteur SET numero = numero + 1 WHERE annee = $1 RETURNING numero', [annee]
    );
    await client.query('COMMIT');
    const n = rows[0].numero;
    // Format : N°XXXX/MAEVA IM/XXX (ex: 0026/MAEVA IM/284)
    return `${String(n).padStart(4, '0')}/MAEVA IM/${n}`;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const TYPES_VALIDES = ['Construction neuve','Rénovation','Clôture','Autre'];
const CATEGORIES_VALIDES = ['Matériaux',"Main d'œuvre"];

function normaliserType(t) {
  if (!t) return 'Autre';
  const tNorm = String(t).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map = { 'construction neuve': 'Construction neuve', 'renovation': 'Rénovation', 'cloture': 'Clôture', 'autre': 'Autre' };
  return map[tNorm] || 'Autre';
}

function normaliserCategorie(c) {
  if (!c) return 'Matériaux';
  const cNorm = String(c).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[''']/g, "'");
  if (cNorm === 'main d oeuvre' || cNorm === "main d'oeuvre" || cNorm === 'main doeuvre') return "Main d'œuvre";
  return 'Matériaux';
}

// Recalcule les totaux d'un devis à partir de ses lignes
async function recalculerTotaux(devisId) {
  const { rows } = await pool.query(
    `SELECT categorie, SUM(prix_total) AS total FROM lignes_devis WHERE devis_id = $1 GROUP BY categorie`, [devisId]
  );
  let totalMateriel = 0, totalMo = 0;
  for (const r of rows) {
    if (r.categorie === "Main d'œuvre") totalMo = Number(r.total) || 0;
    else totalMateriel = Number(r.total) || 0;
  }
  const { rows: d } = await pool.query('SELECT taux_tva FROM devis WHERE id = $1', [devisId]);
  const taux = Number(d[0]?.taux_tva) || 0;
  const totalHt = totalMateriel + totalMo;
  const totalTva = Math.round(totalHt * taux / 100);
  const totalGeneral = totalHt + totalTva;
  await pool.query(
    `UPDATE devis SET total_materiel=$1, total_mo=$2, total_tva=$3, total_general=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
    [totalMateriel, totalMo, totalTva, totalGeneral, devisId]
  );
  return { totalMateriel, totalMo, totalTva, totalGeneral };
}

// GET /api/devis  (liste, filtres: statut, client, q)
router.get('/', requireAuth, async (req, res) => {
  const { statut, client, q } = req.query;
  try {
    const params = [];
    const where = [];
    if (statut) { where.push('statut = $' + (params.length + 1)); params.push(statut); }
    if (client) { where.push('client_nom ILIKE $' + (params.length + 1)); params.push('%' + client + '%'); }
    if (q) { where.push('(titre_objet ILIKE $' + (params.length + 1) + ' OR numero ILIKE $' + (params.length + 1) + ')'); params.push('%' + q + '%'); }
    let sql = 'SELECT * FROM devis';
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY date DESC, id DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/devis/:id  (détail avec lignes)
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const devis = await pool.query('SELECT * FROM devis WHERE id = $1', [id]);
    if (!devis.rows[0]) return res.status(404).json({ message: 'Devis introuvable' });
    const lignes = await pool.query('SELECT * FROM lignes_devis WHERE devis_id = $1 ORDER BY categorie, ordre, id', [id]);
    res.json({ ...devis.rows[0], lignes: lignes.rows });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/devis  (admin, gerant)
router.post('/', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const { titre_objet, client_nom, client_contact, type, taux_tva, lieu, date, batiment_id, note, lignes } = req.body || {};
  if (!titre_objet) return res.status(400).json({ message: 'titre_objet requis' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numero = await prochainNumero();
    const { rows } = await client.query(
      `INSERT INTO devis (numero, date, lieu, titre_objet, client_nom, client_contact, type, taux_tva, batiment_id, note)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [numero, date || null, lieu || 'Abidjan', titre_objet,
       client_nom || '', client_contact || null, normaliserType(type),
       Number(taux_tva) || 0, batiment_id || null, note || null]
    );
    const devisId = rows[0].id;
    if (Array.isArray(lignes)) {
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        const total = Math.round((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0));
        await client.query(
          `INSERT INTO lignes_devis (devis_id, article_id, designation, categorie, unite, quantite, prix_unitaire, prix_total, ordre)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [devisId, l.article_id || null, String(l.designation).trim().toUpperCase(),
           normaliserCategorie(l.categorie), l.unite || 'U',
           Number(l.quantite) || 0, Number(l.prix_unitaire) || 0, total, i]
        );
      }
    }
    await client.query('COMMIT');
    await recalculerTotaux(devisId);
    const final = await pool.query('SELECT * FROM devis WHERE id = $1', [devisId]);
    res.status(201).json(final.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur serveur: ' + e.message });
  } finally {
    client.release();
  }
});

// PUT /api/devis/:id  (admin, gerant) — met à jour l'en-tête et les lignes (remplacement)
router.put('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  const { titre_objet, client_nom, client_contact, type, taux_tva, lieu, date, batiment_id, note, statut, lignes } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE devis SET
         titre_objet = COALESCE($1, titre_objet),
         client_nom = COALESCE($2, client_nom),
         client_contact = COALESCE($3, client_contact),
         type = COALESCE($4, type),
         taux_tva = COALESCE($5, taux_tva),
         lieu = COALESCE($6, lieu),
         date = COALESCE($7, date),
         batiment_id = COALESCE($8, batiment_id),
         note = COALESCE($9, note),
         statut = COALESCE($10, statut),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [titre_objet, client_nom, client_contact, type ? normaliserType(type) : null, taux_tva !== undefined ? Number(taux_tva) : null,
       lieu, date, batiment_id, note, statut, id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Devis introuvable' }); }

    if (Array.isArray(lignes)) {
      await client.query('DELETE FROM lignes_devis WHERE devis_id = $1', [id]);
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        const total = Math.round((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0));
        await client.query(
          `INSERT INTO lignes_devis (devis_id, article_id, designation, categorie, unite, quantite, prix_unitaire, prix_total, ordre)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, l.article_id || null, String(l.designation).trim().toUpperCase(),
           normaliserCategorie(l.categorie), l.unite || 'U',
           Number(l.quantite) || 0, Number(l.prix_unitaire) || 0, total, i]
        );
      }
    }
    await client.query('COMMIT');
    await recalculerTotaux(id);
    const final = await pool.query('SELECT * FROM devis WHERE id = $1', [id]);
    res.json(final.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur serveur: ' + e.message });
  } finally {
    client.release();
  }
});

// POST /api/devis/:id/dupliquer  (admin, gerant)
router.post('/:id/dupliquer', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const src = await client.query('SELECT * FROM devis WHERE id = $1', [id]);
    if (!src.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Devis introuvable' }); }
    const s = src.rows[0];
    const numero = await prochainNumero();
    const { rows } = await client.query(
      `INSERT INTO devis (numero, date, lieu, titre_objet, client_nom, client_contact, type, taux_tva, batiment_id, note)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [numero, s.lieu, s.titre_objet + ' (COPIE)', s.client_nom, s.client_contact, s.type, s.taux_tva, s.batiment_id, s.note]
    );
    const newId = rows[0].id;
    const lignes = await client.query('SELECT * FROM lignes_devis WHERE devis_id = $1 ORDER BY ordre', [id]);
    for (const l of lignes.rows) {
      await client.query(
        `INSERT INTO lignes_devis (devis_id, article_id, designation, categorie, unite, quantite, prix_unitaire, prix_total, ordre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId, l.article_id, l.designation, l.categorie, l.unite || 'U', l.quantite, l.prix_unitaire, l.prix_total, l.ordre]
      );
    }
    await client.query('COMMIT');
    await recalculerTotaux(newId);
    res.status(201).json({ ok: true, id: newId });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// PUT /api/devis/:id/statut  (admin, gerant)
router.put('/:id/statut', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  const { statut } = req.body || {};
  if (!['Brouillon','Envoyé','Accepté','Refusé','Facturé'].includes(statut))
    return res.status(400).json({ message: 'Statut invalide' });
  try {
    const { rows } = await pool.query(
      'UPDATE devis SET statut=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [statut, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Devis introuvable' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE /api/devis/:id  (admin, gerant)
router.delete('/:id', requireAuth, requireRole('admin', 'gerant'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query('DELETE FROM devis WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Devis introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST /api/devis/:id/export  (génère .docx et/ou .pdf)
router.post('/:id/export', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const format = (req.body?.format || 'docx').toLowerCase();
  try {
    const devis = await pool.query('SELECT * FROM devis WHERE id = $1', [id]);
    if (!devis.rows[0]) return res.status(404).json({ message: 'Devis introuvable' });
    const lignes = await pool.query('SELECT * FROM lignes_devis WHERE devis_id = $1 ORDER BY categorie, ordre, id', [id]);
    const cfgRows = await pool.query('SELECT cle, valeur FROM config');
    const config = {};
    cfgRows.rows.forEach((r) => { config[r.cle] = r.valeur; });
    const d = { ...devis.rows[0], lignes: lignes.rows };
    let outPath;
    if (format === 'pdf') outPath = await genererDevisPdf(d, config);
    else outPath = await genererDevisDocx(d, config);
    res.json({ ok: true, chemin: outPath });
  } catch (e) { res.status(500).json({ message: 'Erreur export: ' + e.message }); }
});

module.exports = router;
