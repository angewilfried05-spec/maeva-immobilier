// Fusionne les champs reçus avec la ligne existante pour un UPDATE :
// champ absent (undefined) = valeur conservée, champ vide = effacé (NULL).
const texteOuNull = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
const majuscules = (v) => texteOuNull(v)?.toUpperCase() ?? null;
const entier = (v) => Math.round(Number(v) || 0);
const nombre = (v) => Number(v) || 0;

function fusionner(existant, body, convertisseurs) {
  const res = {};
  for (const [champ, conv] of Object.entries(convertisseurs)) {
    res[champ] = body[champ] === undefined ? existant[champ] : conv(body[champ]);
  }
  return res;
}

module.exports = { fusionner, texteOuNull, majuscules, entier, nombre };
