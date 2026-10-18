// Quittances : chaque versement reçoit un numéro officiel Q-AAAA-NNNNNN
// (compteur annuel, sans trous en usage normal) et un reçu PDF téléchargeable.
const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');
const { nombreEnLettres } = require('./nombre-en-lettres');

const NUM_FMT = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const TYPES = { loyer: 'LOYER', avance: 'AVANCE', caution: 'CAUTION', arriere: 'ARRIÉRÉ' };

function dateFr(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getDate()} ${MOIS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

function moisFr(m) {
  if (!m) return '';
  const [a, mm] = m.split('-');
  return `${MOIS_FR[Number(mm) - 1]} ${a}`;
}

// Numéro suivant pour l'année : compteur transactionnel (pas de doublon possible)
async function prochainNumero(client, annee) {
  const { rows } = await client.query(
    `INSERT INTO quittances_compteur (annee, dernier) VALUES ($1, 1)
     ON CONFLICT (annee) DO UPDATE SET dernier = quittances_compteur.dernier + 1
     RETURNING dernier`,
    [annee]
  );
  return `Q-${annee}-${String(rows[0].dernier).padStart(6, '0')}`;
}

// Émet la quittance d'un versement (idempotent : un versement n'en a qu'une)
async function emettre(client, versementId, userId) {
  const numero = await prochainNumero(client, new Date().getFullYear());
  const { rows } = await client.query(
    `INSERT INTO quittances (numero, versement_id, emis_par) VALUES ($1, $2, $3)
     ON CONFLICT (versement_id) DO NOTHING RETURNING numero`,
    [numero, versementId, userId || null]
  );
  if (rows[0]) return rows[0].numero;
  return (await client.query('SELECT numero FROM quittances WHERE versement_id = $1', [versementId])).rows[0]?.numero || numero;
}

// Reçu PDF (A5 paysage) : même identité visuelle que les devis
async function genererQuittancePdf(donnees, fichier) {
  const { quittance, versement: v, locataire: l, batiment: b, config, emetteur } = donnees;
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 36 });
  const out = fs.createWriteStream(fichier);
  doc.pipe(out);

  const W = doc.page.width - 72;
  const logo = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
  if (fs.existsSync(logo)) doc.image(logo, doc.page.width / 2 - 24, 30, { width: 48 });

  let y = 88;
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#1a3a5c')
    .text((config.nom_societe || 'MAEVA IMMOBILIER').toUpperCase(), 36, y, { width: W, align: 'center' });
  y += 20;
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555')
    .text(config.activite || 'Gestion Location & vente de bâtiment, Construction', 36, y, { width: W, align: 'center' });
  y += 11;
  if (config.site) doc.text(config.site, 36, y, { width: W, align: 'center' });

  y += 26;
  doc.moveTo(36, y).lineTo(36 + W, y).lineWidth(1.2).strokeColor('#1a3a5c').stroke();
  y += 14;
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
    .text(`QUITTANCE  N° ${quittance.numero}`, 36, y, { width: W, align: 'center' });
  y += 24;

  const ligne = (label, valeur) => {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1a3a5c').text(label, 60, y, { width: 130 });
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(valeur || '—', 195, y, { width: W - 160 });
    y += 15;
  };

  ligne('Reçu de :', l.nom_locataire);
  ligne('Bâtiment / Porte :', `${b.nom_batiment}${l.numero_porte ? ' — Porte ' + l.numero_porte : ''}`);
  ligne('Objet :', `${TYPES[v.type] || 'LOYER'} — ${moisFr(v.mois)}`);
  ligne('Montant :', `${NUM_FMT(v.montant)} FCFA`);
  ligne('Mode / Date :', `${v.mode}   ·   ${dateFr(v.date_versement)}`);
  if (emetteur) ligne('Encaissé par :', emetteur);

  y += 4;
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#444444')
    .text(`Soit : ${nombreEnLettres(Number(v.montant))} francs CFA`, 60, y, { width: W - 24 });

  y += 34;
  doc.font('Helvetica').fontSize(9).fillColor('#000000')
    .text(`Fait à Angré, le ${dateFr(new Date())}`, 60, y, { width: W - 24 });
  doc.text('Le Gérant', 36 + W - 150, y);
  doc.moveTo(36 + W - 150, y + 34).lineTo(36 + W - 20, y + 34).lineWidth(0.8).strokeColor('#000000').stroke();

  doc.end();
  await new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); });
  return fichier;
}

function dossierTemporaire() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maeva-quittance-'));
}

module.exports = { emettre, genererQuittancePdf, dossierTemporaire, moisFr, dateFr };
