// Conversion d'un nombre entier en toutes lettres (français, format FCFA).
// Ex: 2823000 -> "DEUX MILLIONS HUIT CENT VINGT-TROIS MILLE FRANCS CFA"

const UNITES = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
  'dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
const DIZAINES = ['', '', 'vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];

function troisChiffres(n) {
  let out = '';
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c > 0) out += (c > 1 ? UNITES[c] + ' cent' : 'cent');
  if (reste > 0) {
    if (out) out += ' ';
    if (reste < 20) out += UNITES[reste];
    else {
      const d = Math.floor(reste / 10);
      const u = reste % 10;
      if (d === 7 || d === 9) {
        out += DIZAINES[d] + '-' + UNITES[10 + u];
      } else if (d === 8 && u === 0) {
        out += 'quatre-vingts';
      } else {
        out += DIZAINES[d];
        if (u === 1 && d !== 8) out += ' et un';
        else if (u > 0) out += '-' + UNITES[u];
      }
    }
  }
  return out;
}

function nombreEnLettres(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return 'zéro franc CFA';

  let out = '';
  const millions = Math.floor(n / 1000000);
  const milliers = Math.floor((n % 1000000) / 1000);
  const reste = n % 1000;

  if (millions > 0) {
    out += (millions > 1 ? troisChiffres(millions) + ' millions' : 'un million');
  }
  if (milliers > 0) {
    if (out) out += ' ';
    out += (milliers > 1 ? troisChiffres(milliers) + ' mille' : 'mille');
  }
  if (reste > 0) {
    if (out) out += ' ';
    out += troisChiffres(reste);
  }
  out += ' francs CFA';
  return out.toUpperCase().replace(/^UN FRANCS/, 'UN FRANC');
}

module.exports = { nombreEnLettres };
