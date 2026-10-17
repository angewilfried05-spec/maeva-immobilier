// Parse le fichier Excel mensuel existant (ex: LOYER 8iem DU MOIS DE AOUT 2026 ANGRE.xlsx)
// Structure observée et calée sur le fichier réel.
const ExcelJS = require('exceljs');

const MOIS_FR = {
  JANVIER: 1, FEVRIER: 2, 'FÉVRIER': 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6,
  JUILLET: 7, AOUT: 8, 'AOÛT': 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12, 'DÉCEMBRE': 12,
};

function cellText(cell) {
  let v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return String(v.result ?? '');
    if (v.text) return String(v.text);
    return '';
  }
  return String(v);
}

function cellNumber(cell) {
  let v = cell.value;
  if (v == null) return null;
  if (typeof v === 'object') v = v.result;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNomLocataire(raw) {
  let s = String(raw).replace(/\s+/g, ' ').trim();
  let porte = null;
  const mPorte = s.match(/^(PORTE\s*\d*|P\s*\d+)\s*/i);
  if (mPorte) {
    porte = mPorte[1].replace(/\s+/g, ' ').trim().toUpperCase();
    s = s.slice(mPorte[0].length).trim();
  }
  let statut = 'Actif';
  if (/\bVIDE\b/i.test(s)) statut = 'Vide';
  const keywords = ['DOIT', 'DÉJÀ', 'DEJA', 'PAYER', 'RESTE', 'NOUVAUX', 'NOUVEAU'];
  let cut = -1;
  for (const kw of keywords) {
    const i = s.toUpperCase().indexOf(kw);
    if (i > 0 && (cut === -1 || i < cut)) cut = i;
  }
  let nom = s, note = '';
  if (cut > 0) { nom = s.slice(0, cut).trim(); note = s.slice(cut).trim(); }
  let arrieres_initial = 0;
  const mDoit = note.match(/DOIT\s+(\d+)\s+MOIS/i);
  if (mDoit) arrieres_initial = Number(mDoit[1]);
  return { porte, nom, note, arrieres_initial, statut };
}

function guessCategorie(designation) {
  const s = designation.toUpperCase();
  if (/(SALAIRE|GARDIEN|CHAUFFEUR|SERVANTE|JARDINIER|REPETITEUR|RÉPÉTITEUR)/.test(s)) return 'Salaires';
  if (/(TRAVAUX|VITRIER|TECHNICIEN|ENTRETIEN|PICINE|PISCINE)/.test(s)) return 'Travaux';
  if (/(WIFI|ELECTRICITE|ÉLECTRICITÉ|CANAL|SYNDIC|NETOYAGE|NETTOYAGE|EAU)/.test(s)) return 'Charges';
  if (/(DEPOT|DÉPÔT|REMBOURS)/.test(s)) return 'Remboursements';
  return 'Autre';
}

async function parseFile(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Aucune feuille trouvée');

  let mois = null, headerRow = null, depensesHeaderRow = null;
  let totalLoyersRow = null, totalDepensesRow = null, remisAuBoss = null;

  ws.eachRow((row, n) => {
    const a = cellText(row.getCell(1)).toUpperCase();
    const b = cellText(row.getCell(2)).toUpperCase();
    if (!mois) {
      const m = (a + ' ' + b).match(/MOIS\s+DE\s+([A-ZÉÛÀ]+)\s+(\d{4})/);
      if (m && MOIS_FR[m[1]]) mois = `${m[2]}-${String(MOIS_FR[m[1]]).padStart(2, '0')}`;
    }
    if (!headerRow && b.includes('QTE') && !a.includes('DESIGNATION')) headerRow = n;
    if (!depensesHeaderRow && a.includes('DESIGNATION')) depensesHeaderRow = n;
    if (a.trim() === 'TOTAL') {
      if (depensesHeaderRow && n > depensesHeaderRow) { if (!totalDepensesRow) totalDepensesRow = n; }
      else if (!totalLoyersRow) totalLoyersRow = n;
    }
    const mBoss = a.match(/REMIS\s+AU\s+BOSS\s*([\d\s.,]*)F?/);
    if (mBoss) remisAuBoss = Number(String(mBoss[1]).replace(/[^\d]/g, '')) || 0;
  });

  if (!headerRow) throw new Error("En-tête du tableau des loyers introuvable");

  const batiments = [];
  let current = null;
  const endLoyers = totalLoyersRow || (depensesHeaderRow ? depensesHeaderRow - 1 : ws.rowCount);
  for (let n = headerRow + 1; n < endLoyers; n++) {
    const row = ws.getRow(n);
    const a = cellText(row.getCell(1)).trim();
    if (!a) continue;
    const qte = cellNumber(row.getCell(2));
    const unit = cellNumber(row.getCell(3));
    const bTxt = cellText(row.getCell(2)).trim();
    const isBatiment = (qte === null && unit === null) && (bTxt === '' || bTxt === a);
    if (isBatiment) {
      current = { nom: a.replace(/\s+/g, ' ').trim(), locataires: [] };
      batiments.push(current);
      continue;
    }
    if (!current) { current = { nom: 'SANS BÂTIMENT', locataires: [] }; batiments.push(current); }
    const parsed = parseNomLocataire(a);
    if (!parsed.nom && !(unit > 0)) continue;
    current.locataires.push({
      numero_porte: parsed.porte,
      nom_locataire: parsed.nom || '(sans nom)',
      loyer_mensuel: unit || 0,
      statut: parsed.statut,
      note: parsed.note || null,
      arrieres_initial: parsed.arrieres_initial,
      qte_payee_ce_mois: qte || 0,
    });
  }

  const depenses = [];
  if (depensesHeaderRow) {
    const end = totalDepensesRow || ws.rowCount;
    for (let n = depensesHeaderRow + 1; n < end; n++) {
      const row = ws.getRow(n);
      const designation = cellText(row.getCell(1)).replace(/\s+/g, ' ').trim();
      if (!designation) continue;
      const qte = cellNumber(row.getCell(2)) ?? 0;
      const unit = cellNumber(row.getCell(3)) ?? 0;
      depenses.push({
        designation, categorie: guessCategorie(designation),
        quantite: qte, montant_unitaire: unit, montant_total: Math.round(qte * unit),
      });
    }
  }

  return { mois: mois || new Date().toISOString().slice(0, 7), batiments, depenses, remis_au_boss: remisAuBoss || 0 };
}

module.exports = { parseFile, parseNomLocataire, guessCategorie };
