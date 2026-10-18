// Notifications automatiques par WhatsApp :
//  - relances planifiées aux débiteurs (jours configurables, ex. le 8 et le 15)
//  - quittance PDF envoyée au locataire juste après un encaissement
// Tout est inopérant tant que le client WhatsApp n'est pas lié (estPret() = false),
// et chaque envoi est tracé dans le journal d'audit.
const pool = require('../config/db');
const { chargerSituations, moisCourant } = require('./situation');
const wa = require('./whatsapp');

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const moisFr = (m) => { const [a, mm] = m.split('-'); return `${MOIS_FR[Number(mm) - 1]} ${a}`; };
const NUM_FMT = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// WHATSAPP_RELANCES_JOURS="8,15" ; WHATSAPP_RELANCES_HEURE=9 (heure locale du serveur)
const JOURS_RELANCES = String(process.env.WHATSAPP_RELANCES_JOURS || '8,15')
  .split(',').map((j) => parseInt(j, 10)).filter((j) => j >= 1 && j <= 28);
const HEURE_RELANCES = Math.min(23, Math.max(0, parseInt(process.env.WHATSAPP_RELANCES_HEURE || '9', 10)));

let timer = null;
let derniereDateExecutee = null; // 'YYYY-MM-DD' du dernier envoi groupé réussi

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Un envoi groupé a-t-il déjà été journalisé aujourd'hui ? (survit aux redémarrages)
async function dejaFaitAujourdhui() {
  const { rows } = await pool.query(
    `SELECT 1 FROM journal_audit
     WHERE action = 'relance.automatique' AND created_at::date = CURRENT_DATE LIMIT 1`
  );
  return rows.length > 0;
}

async function envoyerRelancesDuJour() {
  const mois = moisCourant();
  const { locataires, situations } = await chargerSituations(mois);
  const debiteurs = locataires.filter(
    (l) => l.statut === 'Actif' && situations[l.id]?.dette > 0 && l.telephone
  );
  if (debiteurs.length === 0) {
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, entite, details)
       VALUES (NULL, 'relance.automatique', 'relance', $1)`,
      [JSON.stringify({ mois, envoyes: 0, note: 'aucun débiteur' })]
    );
    return { envoyes: 0 };
  }

  let envoyes = 0;
  const erreurs = [];
  for (const l of debiteurs) {
    const s = situations[l.id];
    const message = `Bonjour ${l.nom_locataire}, sauf erreur de notre part, votre loyer `
      + `présente un solde de ${NUM_FMT(s.dette)} FCFA (${s.dette_mois} mois) à ${moisFr(mois)}. `
      + `Merci de régulariser. — MAEVA IMMOBILIER`;
    try {
      const r = await wa.envoyerMessage(l.telephone, message);
      if (r.success && !r.simulated) envoyes++;
      else if (!r.success) erreurs.push({ locataire: l.nom_locataire, erreur: r.error });
    } catch (e) {
      erreurs.push({ locataire: l.nom_locataire, erreur: e.message });
    }
  }
  await pool.query(
    `INSERT INTO journal_audit (utilisateur_id, action, entite, details)
     VALUES (NULL, 'relance.automatique', 'relance', $1)`,
    [JSON.stringify({ mois, debiteurs: debiteurs.length, envoyes, erreurs })]
  );
  console.log(`[Relances auto] ${envoyes}/${debiteurs.length} rappel(s) envoyé(s) pour ${mois}`);
  return { envoyes, total: debiteurs.length, erreurs };
}

function verifierCalendrier() {
  const maintenant = new Date();
  const jour = maintenant.getDate();
  const heure = maintenant.getHours();
  if (!JOURS_RELANCES.includes(jour) || heure < HEURE_RELANCES) return;
  const date = aujourdhui();
  if (derniereDateExecutee === date) return;
  if (!wa.estPret()) return; // client non lié : on réessaiera au prochain tick
  derniereDateExecutee = date;
  dejaFaitAujourdhui()
    .then((deja) => (deja ? null : envoyerRelancesDuJour()))
    .catch((e) => { derniereDateExecutee = null; console.error('[Relances auto]', e.message); });
}

/** Lance la vérification horaire des relances planifiées. */
function demarrerNotifications() {
  if (timer) return;
  if (process.env.WHATSAPP_RELANCES_AUTO === '0') return;
  // Vérification toutes les 10 minutes (le garde 'derniereDateExecutee' + le journal
  // évitent tout double envoi, même après redémarrage du serveur).
  timer = setInterval(verifierCalendrier, 10 * 60 * 1000);
  timer.unref?.();
  console.log(`[Relances auto] planifiées les jours ${JOURS_RELANCES.join(', ')} à ${HEURE_RELANCES}h`);
}

/** Quittance PDF envoyée au locataire juste après un encaissement (si lié). */
async function notifierVersement(versementId) {
  if (process.env.WHATSAPP_QUITTANCE_AUTO === '0') return;
  if (!wa.estPret()) return; // WhatsApp non lié : on ne bloque pas l'encaissement
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.mois, v.montant, q.numero, q.emis_le, l.telephone,
              l.nom_locataire, l.numero_porte, b.nom AS nom_batiment
       FROM versements v
       JOIN quittances q ON q.versement_id = v.id
       JOIN locataires l ON l.id = v.locataire_id
       JOIN batiments b ON b.id = l.batiment_id
       WHERE v.id = $1`, [versementId]
    );
    const r = rows[0];
    if (!r?.telephone) return;
    const { genererQuittancePdf, dossierTemporaire } = require('./quittances');
    const path = require('path');
    const fs = require('fs/promises');
    const { rows: cfg } = await pool.query('SELECT cle, valeur FROM config');
    const config = Object.fromEntries(cfg.map((c) => [c.cle, c.valeur]));
    const dossier = dossierTemporaire();
    const fichier = path.join(dossier, `quittance_${r.numero}.pdf`);
    await genererQuittancePdf({
      quittance: { numero: r.numero, emis_le: r.emis_le },
      versement: r,
      locataire: { nom_locataire: r.nom_locataire, numero_porte: r.numero_porte },
      batiment: { nom_batiment: r.nom_batiment },
      config, emetteur: null,
    }, fichier);
    const legende = `Quittance ${r.numero} — ${r.mois} · ${NUM_FMT(r.montant)} FCFA reçus. Merci ${r.nom_locataire} !`;
    const res = await wa.envoyerDocument(r.telephone, fichier, legende);
    await fs.rm(dossier, { recursive: true, force: true }).catch(() => {});
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, entite, entite_id, details)
       VALUES (NULL, 'quittance.whatsapp_auto', 'versement', $1, $2)`,
      [versementId, JSON.stringify({ quittance: r.numero, envoye: !!res.success, erreur: res.error || null })]
    );
    if (!res.success) console.error('[WhatsApp auto] quittance :', res.error);
  } catch (e) {
    console.error('[WhatsApp auto] quittance :', e.message);
  }
}

module.exports = { demarrerNotifications, envoyerRelancesDuJour, notifierVersement };
