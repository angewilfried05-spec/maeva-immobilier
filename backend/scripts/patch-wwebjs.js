// Correctif whatsapp-web.js ≤ 1.34.7 : WhatsApp Web ajoute un champ privé
// __x_id énumérable aux modèles média — il écrase l'id du message sortant et
// tout envoi de document échoue avec « Data passed to getter must include an
// id property » (le texte passe, les médias non). Fix officiel PR wwebjs#201923.
// Idempotent : sans effet si déjà appliqué ou si la lib est absente/corrigée.
const fs = require('fs');
const path = require('path');

const cible = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');
if (!fs.existsSync(cible)) {
  console.log('[patch-wwebjs] whatsapp-web.js absent — rien à faire');
  process.exit(0);
}
let src = fs.readFileSync(cible, 'utf8');
if (src.includes('delete message.__x_id;')) {
  console.log('[patch-wwebjs] déjà appliqué');
  process.exit(0);
}
const repere = "// Bot's won't reply if canonicalUrl is set (linking)";
if (!src.includes(repere)) {
  console.error('[patch-wwebjs] point d\'insertion introuvable — vérifier la version de whatsapp-web.js');
  process.exit(1);
}
src = src.replace(repere, `        delete message.__x_id;\n\n        ${repere}`);
fs.writeFileSync(cible, src);
console.log('[patch-wwebjs] envoi de médias corrigé (delete message.__x_id)');
