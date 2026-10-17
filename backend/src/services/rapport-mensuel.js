// Génère le rapport mensuel au format identique au fichier Excel d'origine.
const path = require('path');
const fs = require('fs');
const os = require('os');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { calculerArrieres } = require('./arrieres');

const MOIS_NOMS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'];
const thin = { style: 'thin' };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const NUM_FMT = '#,##0';

function moisLabel(mois) {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS_NOMS[m - 1]} ${y}`;
}

async function genererRapport(mois, outDir) {
  const cfgRows = (await pool.query('SELECT cle, valeur FROM config')).rows;
  const config = {};
  cfgRows.forEach((r) => { config[r.cle] = r.valeur; });

  const batiments = (await pool.query('SELECT * FROM batiments ORDER BY id')).rows;
  const locataires = (await pool.query("SELECT * FROM locataires WHERE statut <> 'Parti' ORDER BY batiment_id, numero_porte NULLS LAST, nom_locataire")).rows;
  const paiements = (await pool.query('SELECT * FROM paiements WHERE mois = $1', [mois])).rows;
  const depenses = (await pool.query('SELECT * FROM depenses WHERE mois = $1', [mois])).rows;
  const resume = (await pool.query('SELECT * FROM resumes WHERE mois = $1', [mois])).rows[0];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Feuil1');
  ws.columns = [{ width: 52 }, { width: 12 }, { width: 14 }, { width: 16 }];

  ws.mergeCells('A1:D1');
  const c1 = ws.getCell('A1');
  c1.value = `${config.nom_societe || 'MAEVA IMMOBILIER'} \n${config.activite || ''}\n`;
  c1.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  c1.font = { bold: true, size: 12 };
  ws.getRow(1).height = 78;

  const logoPath = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    const imgId = wb.addImage({ buffer: fs.readFileSync(logoPath), extension: 'png' });
    ws.addImage(imgId, { tl: { col: 0.1, row: 0.05 }, ext: { width: 90, height: 97 }, editAs: 'oneCell' });
  }

  ws.mergeCells('A2:D2');
  const c2 = ws.getCell('A2');
  c2.value = `LISTE DES LOCATAIRES MOIS DE ${moisLabel(mois)}`;
  c2.font = { bold: true, size: 13 };
  c2.alignment = { horizontal: 'center' };

  let r = 4;
  const head = ws.getRow(r);
  ['NOM ET PRENOM ', 'QTE / MOIS ', 'MONT UNIT  ', 'MONT TOTAL '].forEach((t, i) => {
    const c = head.getCell(i + 1);
    c.value = t; c.font = { bold: true }; c.border = BORDER;
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
  });
  r++;

  const firstLoyerRow = r + 1;
  for (const bat of batiments) {
    const locs = locataires.filter((l) => l.batiment_id === bat.id);
    if (!locs.length) continue;
    ws.mergeCells(`A${r}:D${r}`);
    const cb = ws.getCell(`A${r}`);
    cb.value = bat.nom; cb.font = { bold: true }; cb.border = BORDER;
    r++;
    for (const l of locs) {
      const p = paiements.find((x) => x.locataire_id === l.id);
      const arr = await calculerArrieres(l.id, mois);
      let nom = [l.numero_porte, l.nom_locataire].filter(Boolean).join(' ');
      if (l.statut === 'Vide') nom += ' VIDE';
      else if (arr > 0) nom += ` DOIT ${arr} MOIS`;
      if (p && p.note) nom += ` ${p.note}`;
      else if (l.note && !(arr > 0)) nom += ` ${l.note}`;
      const row = ws.getRow(r);
      row.getCell(1).value = nom;
      row.getCell(2).value = p ? Number(p.quantite_mois_payee) || 0 : 0;
      row.getCell(3).value = Number(l.loyer_mensuel) || 0;
      row.getCell(4).value = { formula: `B${r}*C${r}` };
      for (let i = 1; i <= 4; i++) {
        row.getCell(i).border = BORDER;
        if (i >= 3) row.getCell(i).numFmt = NUM_FMT;
      }
      r++;
    }
  }
  const lastLoyerRow = r - 1;

  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).value = 'TOTAL ';
  ws.getCell(`A${r}`).font = { bold: true };
  ws.getCell(`D${r}`).value = { formula: `SUM(D${firstLoyerRow}:D${lastLoyerRow})` };
  ws.getCell(`D${r}`).font = { bold: true };
  ws.getCell(`D${r}`).numFmt = NUM_FMT;
  for (let i = 1; i <= 4; i++) ws.getRow(r).getCell(i).border = BORDER;
  const totalLoyerRow = r;
  r += 2;

  ws.mergeCells(`A${r}:D${r}`);
  ws.getCell(`A${r}`).value = 'LISTE DES DEPENSES  ';
  ws.getCell(`A${r}`).font = { bold: true, size: 12 };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center' };
  r += 2;
  const dh = ws.getRow(r);
  ['DESIGNATION ', 'QTE /MOIS ', ' MONT UNIT  ', 'TOTAL '].forEach((t, i) => {
    const c = dh.getCell(i + 1);
    c.value = t; c.font = { bold: true }; c.border = BORDER;
  });
  r++;
  const firstDepRow = r;
  for (const d of depenses) {
    const row = ws.getRow(r);
    row.getCell(1).value = d.designation + (d.beneficiaire ? ` (${d.beneficiaire})` : '');
    row.getCell(2).value = Number(d.quantite) || 0;
    row.getCell(3).value = Number(d.montant_unitaire) || 0;
    row.getCell(4).value = { formula: `B${r}*C${r}` };
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).border = BORDER;
      if (i >= 3) row.getCell(i).numFmt = NUM_FMT;
    }
    r++;
  }
  const lastDepRow = Math.max(firstDepRow, r - 1);
  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).value = 'TOTAL ';
  ws.getCell(`A${r}`).font = { bold: true };
  ws.getCell(`D${r}`).value = depenses.length ? { formula: `SUM(D${firstDepRow}:D${lastDepRow})` } : 0;
  ws.getCell(`D${r}`).font = { bold: true };
  ws.getCell(`D${r}`).numFmt = NUM_FMT;
  for (let i = 1; i <= 4; i++) ws.getRow(r).getCell(i).border = BORDER;
  const totalDepRow = r;
  r += 2;

  const labels = ws.getRow(r);
  labels.getCell(2).value = 'TOTAL LOYER';
  labels.getCell(3).value = 'TOTAL DEPENSES';
  labels.getCell(4).value = 'TOTAL RESTES';
  for (let i = 2; i <= 4; i++) { labels.getCell(i).font = { bold: true }; labels.getCell(i).border = BORDER; }
  r++;
  const solde = ws.getRow(r);
  solde.getCell(1).value = 'SOLDE RESTANT';
  solde.getCell(1).font = { bold: true };
  solde.getCell(2).value = { formula: `D${totalLoyerRow}` };
  solde.getCell(3).value = { formula: `D${totalDepRow}` };
  solde.getCell(4).value = { formula: `B${r}-C${r}` };
  for (let i = 1; i <= 4; i++) {
    solde.getCell(i).border = BORDER;
    if (i >= 2) { solde.getCell(i).numFmt = NUM_FMT; solde.getCell(i).font = { bold: true }; }
  }
  r += 2;

  const today = new Date();
  ws.getCell(`A${r}`).value = `LE ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  r++;
  const remis = resume ? Number(resume.montant_remis_au_proprietaire) || 0 : 0;
  ws.getCell(`A${r}`).value = `SOMMES TOTAL REMIS AU BOSS      ${remis.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')}F`;
  ws.getCell(`A${r}`).font = { bold: true };

  const dir = outDir || path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER', 'rapports');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `LOYER DU MOIS DE ${moisLabel(mois)} ${config.site || ''}`.trim() + '.xlsx';
  const outPath = path.join(dir, fileName);
  await wb.xlsx.writeFile(outPath);
  return outPath;
}

module.exports = { genererRapport };
