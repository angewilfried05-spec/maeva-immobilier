// Génération du devis en .docx (lib docx) et .pdf (lib pdfkit).
// Reproduit le format visuel du modèle Excel MAEVA IMMOBILIER.
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ImageRun,
} = require('docx');
const PDFDocument = require('pdfkit');

const { nombreEnLettres } = require('./nombre-en-lettres');

const NUM_FMT = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function dossierDevis() {
  const dir = path.join(os.homedir(), 'Documents', 'MAEVA IMMOBILIER', 'devis');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dateFr(d) {
  if (!d) return '';
  const dt = new Date(d);
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${dt.getDate()} ${mois[dt.getMonth()]} ${dt.getFullYear()}`;
}

function lignesParCategorie(devis, categorie) {
  return devis.lignes.filter((l) => l.categorie === categorie);
}

function sousTotal(devis, categorie) {
  return devis.lignes.filter((l) => l.categorie === categorie).reduce((s, l) => s + (Number(l.prix_total) || 0), 0);
}

// ===================== DOCX =====================

async function genererDevisDocx(devis, config) {
  const logoPath = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
  const nomSociete = (config.nom_societe || 'MAEVA  IMMOBILIER').replace(/\s+/g, '  ');
  const activite = config.activite || 'Gestion Location & vente de bâtiment, Construction';

  const children = [];

  // En-tête : logo + nom société + activité
  if (fs.existsSync(logoPath)) {
    children.push(new Paragraph({
      children: [new ImageRun({ data: fs.readFileSync(logoPath), transformation: { width: 90, height: 97 } })],
      alignment: AlignmentType.CENTER, spacing: { after: 80 },
    }));
  }
  children.push(new Paragraph({
    children: [new TextRun({ text: nomSociete, bold: true, size: 28 })],
    alignment: AlignmentType.CENTER, spacing: { after: 40 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: activite, size: 18, color: '555555' })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
  }));

  // Numéro + lieu/date
  children.push(new Paragraph({
    children: [new TextRun({ text: `DEVIS N°${devis.numero}`, bold: true, size: 22 })],
    spacing: { after: 60 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `${devis.lieu || 'Abidjan'}, le ${dateFr(devis.date)}`, size: 22 })],
    alignment: AlignmentType.RIGHT, spacing: { after: 120 },
  }));

  // Client
  const clientText = `CLIENT : ${devis.client_nom || ''}${devis.client_contact ? '  CONTACT : ' + devis.client_contact : ''}`;
  children.push(new Paragraph({
    children: [new TextRun({ text: clientText, bold: true, size: 22 })],
    spacing: { after: 120 },
  }));

  // Titre du devis
  children.push(new Paragraph({
    children: [new TextRun({ text: devis.titre_objet, bold: true, size: 26 })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
  }));

  // Tableau
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
  const borders = { top: border, bottom: border, left: border, right: border };

  // Colonnes : Désignation | UNITE | Quantité | Prix unitaire | Prix total
  const colWidths = [40, 12, 14, 17, 17]; // pourcentages

  function makeHeaderRow() {
    return new TableRow({
      children: ['Désignation', 'UNITE', 'Quantité', 'Prix unitaire', 'Prix total'].map((t, i) => new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: t, bold: true, size: 20 })] })],
      })),
      tableHeader: true,
    });
  }

  function makeLigneRow(l) {
    return new TableRow({
      children: [
        new TableCell({ borders, width: { size: colWidths[0], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: l.designation, size: 20 })] })] }),
        new TableCell({ borders, width: { size: colWidths[1], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l.unite || 'U', size: 20 })] })] }),
        new TableCell({ borders, width: { size: colWidths[2], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(l.quantite), size: 20 })] })] }),
        new TableCell({ borders, width: { size: colWidths[3], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: NUM_FMT(l.prix_unitaire), size: 20 })] })] }),
        new TableCell({ borders, width: { size: colWidths[4], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: NUM_FMT(l.prix_total), size: 20 })] })] }),
      ],
    });
  }

  function makeTotalRow(label, montant, isGrand = false) {
    return new TableRow({
      children: [
        new TableCell({ borders, columnSpan: 4,
          shading: isGrand ? { fill: '1a4f8b' } : undefined,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: label, bold: true, size: isGrand ? 22 : 20, color: isGrand ? 'FFFFFF' : '000000' })] })] }),
        new TableCell({ borders,
          shading: isGrand ? { fill: '1a4f8b' } : undefined,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: NUM_FMT(montant), bold: true, size: isGrand ? 22 : 20, color: isGrand ? 'FFFFFF' : '000000' })] })] }),
      ],
    });
  }

  // Section Matériaux
  const rows = [makeHeaderRow()];
  const lignesMateriel = lignesParCategorie(devis, 'Matériaux');
  lignesMateriel.forEach((l) => rows.push(makeLigneRow(l)));
  rows.push(makeTotalRow('TOTAL MATERIEL', sousTotal(devis, 'Matériaux')));

  // Section Main d'œuvre (nouveau tableau avec son propre en-tête)
  const lignesMo = lignesParCategorie(devis, "Main d'œuvre");

  children.push(new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Main d'œuvre : titre + tableau
  children.push(new Paragraph({
    children: [new TextRun({ text: "MAIN D'ŒUVRE", bold: true, size: 22, color: '1a4f8b' })],
    spacing: { before: 200, after: 80 },
  }));

  const rowsMo = [makeHeaderRow()];
  lignesMo.forEach((l) => rowsMo.push(makeLigneRow(l)));
  rowsMo.push(makeTotalRow("MAIN D'ŒUVRE", sousTotal(devis, "Main d'œuvre")));

  children.push(new Table({
    rows: rowsMo,
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Totaux finaux
  children.push(new Paragraph({ spacing: { before: 200 } }));
  const totalHt = (devis.total_materiel || 0) + (devis.total_mo || 0);
  const rowsTotaux = [];
  rowsTotaux.push(makeTotalRow('TOTAL MATERIEL', devis.total_materiel || 0));
  rowsTotaux.push(makeTotalRow("MAIN D'ŒUVRE", devis.total_mo || 0));
  if (Number(devis.taux_tva) > 0) {
    rowsTotaux.push(makeTotalRow(`TVA ${devis.taux_tva}%`, devis.total_tva || 0));
  } else {
    rowsTotaux.push(makeTotalRow('TVA 0%', 0));
  }
  rowsTotaux.push(makeTotalRow('TOTAL  GENERAL', devis.total_general || 0, true));

  children.push(new Table({
    rows: rowsTotaux,
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Montant en lettres
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Arrêté le présent devis à la somme de :', bold: true, size: 22 })],
    spacing: { after: 60 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: nombreEnLettres(devis.total_general), bold: true, size: 22 })],
    spacing: { after: 400 },
  }));

  // Signature
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Le Gérant', bold: true, size: 22 })],
    alignment: AlignmentType.RIGHT, spacing: { after: 600 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: '_____________________________', size: 22 })],
    alignment: AlignmentType.RIGHT,
  }));

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const dir = dossierDevis();
  const fileName = `Devis_${devis.numero.replace(/\//g, '-')}_${(devis.client_nom || '').replace(/[^a-zA-Z0-9]/g, '')}.docx`;
  const outPath = path.join(dir, fileName);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

// ===================== PDF =====================

async function genererDevisPdf(devis, config) {
  const logoPath = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
  const nomSociete = config.nom_societe || 'MAEVA  IMMOBILIER';
  const activite = config.activite || 'Gestion Location & vente de bâtiment, Construction';

  const dir = dossierDevis();
  const fileName = `Devis_${devis.numero.replace(/\//g, '-')}_${(devis.client_nom || '').replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
  const outPath = path.join(dir, fileName);
  const stream = fs.createWriteStream(outPath);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  doc.pipe(stream);

  const pageW = 595;
  const margin = 50;
  const contentW = pageW - 2 * margin;
  // Colonnes : Désignation | UNITE | Quantité | Prix unitaire | Prix total
  const colW = [contentW * 0.40, contentW * 0.12, contentW * 0.14, contentW * 0.17, contentW * 0.17];
  const colX = [margin];
  for (let i = 1; i < 5; i++) colX[i] = colX[i - 1] + colW[i - 1];

  // Logo
  let y = doc.y;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, (pageW - 90) / 2, y, { width: 90, height: 97 });
    y += 105;
  }
  doc.y = y;
  doc.fontSize(16).font('Helvetica-Bold').text(nomSociete, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').fillColor('#555555').text(activite, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1.5);

  // Numéro + lieu/date
  doc.fontSize(11).font('Helvetica-Bold').text(`DEVIS N°${devis.numero}`);
  doc.moveDown(0.3);
  doc.font('Helvetica').text(`${devis.lieu || 'Abidjan'}, le ${dateFr(devis.date)}`, { align: 'right' });
  doc.moveDown(0.5);

  // Client
  const clientText = `CLIENT : ${devis.client_nom || ''}${devis.client_contact ? '  CONTACT : ' + devis.client_contact : ''}`;
  doc.font('Helvetica-Bold').text(clientText);
  doc.moveDown(0.8);

  // Titre
  doc.fontSize(14).font('Helvetica-Bold').text(devis.titre_objet, { align: 'center' });
  doc.moveDown(1);

  function rowHeader(y) {
    doc.rect(margin, y, contentW, 22).fill('#1a4f8b');
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
    const labels = ['Désignation', 'UNITE', 'Quantité', 'Prix unitaire', 'Prix total'];
    const aligns = ['left', 'center', 'center', 'right', 'right'];
    for (let i = 0; i < 5; i++) {
      doc.text(labels[i], colX[i] + 4, y + 6, { width: colW[i] - 4, align: aligns[i] });
    }
    doc.fillColor('#000000');
    return y + 22;
  }

  function rowLigne(y, l) {
    doc.rect(margin, y, contentW, 20).stroke('#999999');
    doc.fontSize(9).font('Helvetica');
    doc.text(l.designation, colX[0] + 4, y + 5, { width: colW[0] - 4 });
    doc.text(l.unite || 'U', colX[1] + 4, y + 5, { width: colW[1] - 4, align: 'center' });
    doc.text(String(l.quantite), colX[2] + 4, y + 5, { width: colW[2] - 4, align: 'center' });
    doc.text(NUM_FMT(l.prix_unitaire), colX[3] + 4, y + 5, { width: colW[3] - 4, align: 'right' });
    doc.text(NUM_FMT(l.prix_total), colX[4] + 4, y + 5, { width: colW[4] - 4, align: 'right' });
    return y + 20;
  }

  function rowTotal(y, label, montant, isGrand = false) {
    doc.rect(margin, y, contentW, isGrand ? 26 : 20).fill(isGrand ? '#1a4f8b' : '#f2f4f7');
    doc.fontSize(isGrand ? 12 : 10).font('Helvetica-Bold');
    doc.fillColor(isGrand ? '#FFFFFF' : '#000000');
    doc.text(label, colX[0] + 4, y + (isGrand ? 7 : 5), { width: colX[4] - colX[0] - 4, align: 'right' });
    doc.text(NUM_FMT(montant), colX[4] + 4, y + (isGrand ? 7 : 5), { width: colW[4] - 4, align: 'right' });
    doc.fillColor('#000000');
    return y + (isGrand ? 26 : 20);
  }

  // Tableau Matériaux
  y = doc.y;
  y = rowHeader(y);
  const lignesMateriel = lignesParCategorie(devis, 'Matériaux');
  lignesMateriel.forEach((l) => { y = rowLigne(y, l); });
  y = rowTotal(y, 'TOTAL MATERIEL', sousTotal(devis, 'Matériaux'));

  // Section Main d'œuvre
  y += 15;
  doc.y = y;
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a4f8b').text("MAIN D'ŒUVRE");
  doc.fillColor('#000000');
  y = doc.y + 6;
  y = rowHeader(y);
  const lignesMo = lignesParCategorie(devis, "Main d'œuvre");
  lignesMo.forEach((l) => { y = rowLigne(y, l); });
  y = rowTotal(y, "MAIN D'ŒUVRE", sousTotal(devis, "Main d'œuvre"));

  // Totaux finaux
  y += 15;
  y = rowTotal(y, 'TOTAL MATERIEL', devis.total_materiel || 0);
  y = rowTotal(y, "MAIN D'ŒUVRE", devis.total_mo || 0);
  y = rowTotal(y, `TVA ${devis.taux_tva || 0}%`, devis.total_tva || 0);
  y = rowTotal(y, 'TOTAL  GENERAL', devis.total_general || 0, true);

  doc.y = y + 30;

  // Montant en lettres
  doc.fontSize(11).font('Helvetica-Bold').text('Arrêté le présent devis à la somme de :');
  doc.moveDown(0.3);
  doc.text(nombreEnLettres(devis.total_general));
  doc.moveDown(2);

  // Signature
  doc.font('Helvetica-Bold').text('Le Gérant', { align: 'right' });
  doc.moveDown(1.5);
  doc.font('Helvetica').text('_____________________________', { align: 'right' });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

module.exports = { genererDevisDocx, genererDevisPdf };
