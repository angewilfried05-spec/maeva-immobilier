// Sauvegarde / restauration complète de la base au format JSON (sans dépendre de pg_dump).
// Les valeurs sont exportées sous leur forme texte PostgreSQL brute : l'aller-retour est exact.
const fs = require('fs');
const path = require('path');
const os = require('os');
const pool = require('../config/db');

// Ordre parents -> enfants (utilisé pour la restauration)
// jetons_refresh volontairement absent : restaurer révoque les sessions (TRUNCATE CASCADE).
const TABLES = [
  'utilisateurs', 'journal_audit', 'batiments', 'locataires', 'loyers_historique', 'paiements',
  'versements', 'quittances', 'quittances_compteur', 'notes_loyers',
  'depenses', 'resumes', 'config', 'catalogue_articles', 'devis', 'lignes_devis', 'devis_compteur',
];
// Tables obligatoires dans un fichier de sauvegarde (les autres peuvent manquer : anciennes versions)
const TABLES_REQUISES = ['utilisateurs', 'batiments', 'locataires', 'depenses'];

async function tablesExistantes(client) {
  const { rows } = await client.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1)', [TABLES]
  );
  return TABLES.filter((t) => rows.some((r) => r.table_name === t));
}
const TYPES_BRUTS = { getTypeParser: () => (v) => v };
const MAX_AUTO = 30;
const INTERVALLE_VERIF_MS = 60 * 60 * 1000;

function dossierSauvegardes() {
  const dir = process.env.MAEVA_DOSSIER_SAUVEGARDES
    || path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER', 'sauvegardes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function infos(fichier) {
  const nom = path.basename(fichier);
  const st = fs.statSync(fichier);
  return { nom, type: nom.split('_')[0], taille: st.size, date: st.mtime.toISOString() };
}

function listerSauvegardes() {
  const dir = dossierSauvegardes();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => infos(path.join(dir, f)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function nettoyerAnciennes() {
  const dir = dossierSauvegardes();
  fs.readdirSync(dir)
    .filter((f) => f.startsWith('auto_') && f.endsWith('.json'))
    .sort().reverse()
    .slice(MAX_AUTO)
    .forEach((f) => fs.unlinkSync(path.join(dir, f)));
}

async function creerSauvegarde(type = 'manuel') {
  const client = await pool.connect();
  const tables = {};
  try {
    // Instantané cohérent de toutes les tables
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const t of await tablesExistantes(client)) {
      const { rows } = await client.query({ text: `SELECT * FROM ${t} ORDER BY 1`, types: TYPES_BRUTS });
      tables[t] = rows;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const contenu = { application: 'maeva-immobilier', format: 1, cree_le: new Date().toISOString(), tables };
  const fichier = path.join(dossierSauvegardes(), `${type}_${horodatage()}.json`);
  fs.writeFileSync(fichier, JSON.stringify(contenu));
  if (type === 'auto') nettoyerAnciennes();
  return infos(fichier);
}

function valider(contenu) {
  if (!contenu || contenu.application !== 'maeva-immobilier' || typeof contenu.tables !== 'object') {
    throw new Error("Ce fichier n'est pas une sauvegarde MAEVA IMMOBILIER");
  }
  for (const t of TABLES_REQUISES) {
    if (!Array.isArray(contenu.tables[t])) throw new Error(`Sauvegarde incomplète : table ${t} absente`);
  }
  if (!contenu.tables.utilisateurs.length) throw new Error('Sauvegarde invalide : aucun utilisateur');
}

// Remplace TOUTES les données par celles de la sauvegarde (une sauvegarde de sécurité est faite avant).
async function restaurer(contenu) {
  valider(contenu);
  const securite = await creerSauvegarde('avant-restauration');
  const client = await pool.connect();
  const compte = {};
  try {
    await client.query('BEGIN');
    const tables = await tablesExistantes(client);
    await client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    for (const t of tables) {
      const lignes = Array.isArray(contenu.tables[t]) ? contenu.tables[t] : [];
      const { rows: colRows } = await client.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [t]
      );
      const colonnes = colRows.map((r) => r.column_name);
      for (const ligne of lignes) {
        const cols = Object.keys(ligne).filter((c) => colonnes.includes(c));
        if (!cols.length) continue;
        await client.query(
          `INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')})`,
          cols.map((c) => ligne[c])
        );
      }
      if (colonnes.includes('id')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`
        );
      }
      compte[t] = lignes.length;
    }
    // Sauvegarde antérieure au compte en FCFA : on convertit ses paiements
    if (!Array.isArray(contenu.tables.versements) && tables.includes('versements')) {
      await require('../migrations/004_versements').convertir(client);
    }
    // Comptes restaurés encore sur un mot de passe par défaut : changement obligatoire
    await require('../migrations/005_mdp_a_changer').up(client);
    // Sauvegarde antérieure aux quittances : on numérote les versements restaurés
    if (tables.includes('quittances')) {
      await require('../migrations/006_api_v1').completerQuittances(client);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { compte, sauvegarde_securite: securite.nom };
}

async function verifierSauvegardeAuto() {
  try {
    const jour = horodatage().slice(0, 10);
    const existe = fs.readdirSync(dossierSauvegardes()).some((f) => f.startsWith(`auto_${jour}`));
    if (!existe) {
      const s = await creerSauvegarde('auto');
      console.log(`[sauvegarde] Sauvegarde automatique créée : ${s.nom}`);
    }
  } catch (e) {
    console.error('[sauvegarde] Échec de la sauvegarde automatique :', e.message);
  }
}

function demarrerSauvegardeAuto() {
  verifierSauvegardeAuto();
  setInterval(verifierSauvegardeAuto, INTERVALLE_VERIF_MS).unref();
}

module.exports = {
  dossierSauvegardes, listerSauvegardes, creerSauvegarde, restaurer, demarrerSauvegardeAuto,
};
