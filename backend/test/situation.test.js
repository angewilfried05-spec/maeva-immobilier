const test = require('node:test');
const assert = require('node:assert/strict');
const { calculerSituation, loyerDuMois, moisSuivant } = require('../src/services/situation');

const loc = (o = {}) => ({ statut: 'Actif', debut_suivi: '2026-08', solde_initial: 0, mois_sortie: null, loyer_mensuel: 50000, ...o });
const H50 = [{ a_partir_de: '2026-08', montant: 50000 }];
const v = (mois, montant) => ({ mois, montant });

test('moisSuivant passe à l\'année suivante', () => {
  assert.equal(moisSuivant('2026-12'), '2027-01');
  assert.equal(moisSuivant('2026-09'), '2026-10');
});

test('loyerDuMois applique le loyer en vigueur, et le premier connu avant le premier changement', () => {
  const h = [{ a_partir_de: '2026-08', montant: 50000 }, { a_partir_de: '2026-10', montant: 60000 }];
  assert.equal(loyerDuMois(h, '2026-07'), 50000);
  assert.equal(loyerDuMois(h, '2026-09'), 50000);
  assert.equal(loyerDuMois(h, '2026-10'), 60000);
  assert.equal(loyerDuMois(h, '2027-03'), 60000);
});

test('dette en FCFA et en mois', () => {
  const s = calculerSituation(loc(), H50, [v('2026-08', 50000)], '2026-10');
  assert.equal(s.du, 150000);
  assert.equal(s.verse, 50000);
  assert.equal(s.dette, 100000);
  assert.equal(s.dette_mois, 2);
  assert.equal(s.recu_mois, 0);
  assert.equal(s.loyer_du_mois, 50000);
});

test('plusieurs versements partiels dans le mois', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [v('2026-10', 20000), v('2026-10', 30000)], '2026-10');
  assert.equal(s.recu_mois, 50000);
  assert.equal(s.dette, 0);
  assert.equal(s.avance, 0);
  assert.equal(s.paye_jusqu_a, null);
});

test('paiement partiel : dette en fraction de mois', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [v('2026-10', 25000)], '2026-10');
  assert.equal(s.dette, 25000);
  assert.equal(s.dette_mois, 0.5);
});

test('avance : payé jusqu\'à un mois futur', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [v('2026-10', 150000)], '2026-10');
  assert.equal(s.avance, 100000);
  assert.equal(s.paye_jusqu_a, '2026-12');
  // Le mois suivant, sans nouveau versement : toujours couvert
  const n = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [v('2026-10', 150000)], '2026-11');
  assert.equal(n.dette, 0);
  assert.equal(n.paye_jusqu_a, '2026-12');
});

test('changement de loyer : la dette passée garde l\'ancien prix', () => {
  const h = [{ a_partir_de: '2026-08', montant: 50000 }, { a_partir_de: '2026-10', montant: 60000 }];
  const s = calculerSituation(loc(), h, [], '2026-10');
  assert.equal(s.du, 160000);
  assert.equal(s.dette_mois, 2.7);
  assert.equal(s.loyer, 60000);
});

test('dette de départ ajoutée', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10', solde_initial: 100000 }), H50, [v('2026-10', 50000)], '2026-10');
  assert.equal(s.dette, 100000);
  assert.equal(s.dette_mois, 2);
});

test('départ : plus de loyer dû après le mois de sortie, la retenue de caution réduit la dette', () => {
  const l = loc({ statut: 'Parti', mois_sortie: '2026-09' });
  const s = calculerSituation(l, H50, [v('2026-08', 50000), v('2026-09', 30000)], '2026-12');
  assert.equal(s.du, 100000);
  assert.equal(s.dette, 20000);
  assert.equal(s.loyer_du_mois, 0);
  assert.equal(s.paye_jusqu_a, null);
});

test('porte vide : rien n\'est dû', () => {
  const s = calculerSituation(loc({ statut: 'Vide', debut_suivi: null }), H50, [], '2026-10');
  assert.equal(s.du, 0);
  assert.equal(s.dette, 0);
  assert.equal(s.loyer_du_mois, 0);
});

test('versements d\'un occupant précédent (avant le début du suivi) ignorés', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [v('2026-08', 200000)], '2026-10');
  assert.equal(s.verse, 0);
  assert.equal(s.dette, 50000);
});

test('mois antérieur au début du suivi : rien n\'est dû', () => {
  const s = calculerSituation(loc({ debut_suivi: '2026-10' }), H50, [], '2026-09');
  assert.equal(s.du, 0);
  assert.equal(s.loyer_du_mois, 0);
});
