export function fcfa(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function moisLabel(mois) {
  if (!mois) return '';
  const [y, m] = String(mois).split('-').map(Number);
  return `${MOIS_NOMS[m - 1]} ${y}`;
}

export function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

export function fmtNombre(n) {
  return String(n).replace('.', ',');
}

export function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateFr(d) {
  return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
}

// Badge de situation d'un compte locataire (voir backend/src/services/situation.js)
export function situationBadge(sit, statut) {
  if (statut === 'Vide') return { classe: 'vide', texte: 'Porte vide' };
  if (!sit) return { classe: 'vide', texte: '—' };
  if (sit.dette > 0) return { classe: 'retard', texte: `Doit ${fcfa(sit.dette)} F (${fmtNombre(sit.dette_mois)} mois)` };
  if (statut === 'Parti') return { classe: 'vide', texte: 'Soldé' };
  if (sit.paye_jusqu_a) return { classe: 'avance', texte: `Payé jusqu'à ${moisLabel(sit.paye_jusqu_a)}` };
  if (sit.loyer_du_mois > 0) return { classe: 'ok', texte: sit.avance > 0 ? `À jour (+${fcfa(sit.avance)} F)` : 'À jour' };
  return { classe: 'vide', texte: '—' };
}

export function moisPrecedent(mois) {
  let [y, m] = mois.split('-').map(Number);
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function moisSuivant(mois) {
  let [y, m] = mois.split('-').map(Number);
  m += 1; if (m === 13) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
