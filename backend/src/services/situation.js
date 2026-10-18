// Compte d'un locataire en FCFA à la fin d'un mois donné.
//   dû    = dette de départ + loyer de chaque mois (au prix de ce mois) du début du suivi
//           jusqu'au mois demandé (ou jusqu'au mois de sortie)
//   versé = versements rattachés aux mois du suivi, jusqu'au mois demandé
//   solde = dû - versé  (> 0 : dette, < 0 : avance)
const pool = require('../config/db');

const LIMITE_MOIS_AVANCE = 240;

function moisSuivant(m) {
  let [y, mo] = m.split('-').map(Number);
  mo += 1; if (mo === 13) { mo = 1; y += 1; }
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

// historique trié par a_partir_de croissant. Avant le premier changement connu : premier loyer connu.
function loyerDuMois(historique, m) {
  let montant = historique.length ? Number(historique[0].montant) : 0;
  for (const h of historique) {
    if (h.a_partir_de > m) break;
    montant = Number(h.montant);
  }
  return montant;
}

function situationVide(loyer) {
  return { du: 0, verse: 0, solde: 0, dette: 0, dette_mois: 0, avance: 0, paye_jusqu_a: null, recu_mois: 0, loyer_du_mois: 0, loyer: loyer || 0 };
}

function calculerSituation(loc, historique, versements, mois) {
  const debut = loc.debut_suivi;
  const loyerActuel = historique.length ? loyerDuMois(historique, mois) : Number(loc.loyer_mensuel) || 0;
  const recuMois = versements.filter((v) => v.mois === mois && (!debut || v.mois >= debut))
    .reduce((s, v) => s + Number(v.montant), 0);
  if (loc.statut === 'Vide' || !debut || debut > mois) return { ...situationVide(loyerActuel), recu_mois: recuMois };

  const fin = loc.mois_sortie && loc.mois_sortie < mois ? loc.mois_sortie : mois;
  let du = Number(loc.solde_initial) || 0;
  for (let m = debut; m <= fin; m = moisSuivant(m)) du += loyerDuMois(historique, m);
  const verse = versements.filter((v) => v.mois >= debut && v.mois <= mois).reduce((s, v) => s + Number(v.montant), 0);
  const solde = du - verse;
  const dette = Math.max(0, solde);
  const avance = Math.max(0, -solde);
  const loyerRef = loyerDuMois(historique, fin) || Number(loc.loyer_mensuel) || 0;
  const actifCeMois = !loc.mois_sortie || loc.mois_sortie >= mois;

  // Avance : jusqu'à quel mois les loyers suivants sont-ils couverts ?
  let payeJusquA = null;
  if (avance > 0 && actifCeMois) {
    let credit = avance;
    let m = moisSuivant(mois);
    for (let i = 0; i < LIMITE_MOIS_AVANCE; i++) {
      if (loc.mois_sortie && m > loc.mois_sortie) break;
      const l = loyerDuMois(historique, m);
      if (!l || credit < l) break;
      credit -= l; payeJusquA = m; m = moisSuivant(m);
    }
  }

  return {
    du, verse, solde, dette, avance,
    dette_mois: loyerRef ? Math.round((dette / loyerRef) * 10) / 10 : 0,
    paye_jusqu_a: payeJusquA,
    recu_mois: recuMois,
    loyer_du_mois: actifCeMois ? loyerDuMois(historique, mois) : 0,
    loyer: loyerRef,
  };
}

function grouper(rows) {
  const map = {};
  for (const r of rows) (map[r.locataire_id] ||= []).push(r);
  return map;
}

// Situations de tous les locataires (ou d'une liste d'ids) à la fin du mois donné : 3 requêtes au total.
async function chargerSituations(mois, ids = null, surcharge = {}) {
  const filtre = ids ? ' WHERE id = ANY($1)' : '';
  const filtreLoc = ids ? ' AND locataire_id = ANY($2)' : '';
  const params = ids ? [ids] : [];
  const locataires = (await pool.query(
    `SELECT * FROM locataires${filtre} ORDER BY batiment_id, numero_porte NULLS LAST, nom_locataire`, params
  )).rows;
  const historiques = grouper((await pool.query(
    `SELECT locataire_id, a_partir_de, montant FROM loyers_historique WHERE TRUE${ids ? ' AND locataire_id = ANY($1)' : ''} ORDER BY a_partir_de`,
    params
  )).rows);
  const versements = grouper((await pool.query(
    `SELECT locataire_id, mois, montant FROM versements WHERE mois <= $1${filtreLoc}`,
    ids ? [mois, ids] : [mois]
  )).rows);
  const situations = {};
  for (const l of locataires) {
    situations[l.id] = calculerSituation({ ...l, ...(surcharge[l.id] || {}) }, historiques[l.id] || [], versements[l.id] || [], mois);
  }
  return { locataires, situations };
}

module.exports = { calculerSituation, chargerSituations, loyerDuMois, moisSuivant, moisCourant };
