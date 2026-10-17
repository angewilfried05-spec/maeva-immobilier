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
