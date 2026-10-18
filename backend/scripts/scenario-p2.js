// Scénario de test Phase 2 sur la base de test (maeva_test_p2, port 4002).
// Usage : node test-p2.js
const API = 'http://localhost:4002';
let ok = 0, ko = 0;
const t = (nom, cond) => { if (cond) { ok++; console.log('  ✓', nom); } else { ko++; console.log('  ✗ ÉCHEC:', nom); } };

async function req(method, url, body, token) {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

(async () => {
  // Login — le mot de passe a été posé par test-p2-reset.js sur la copie
  let r = await req('POST', '/api/v1/auth/login', { username: 'tahbiarmand', password: 'TestP2!2026' });
  if (r.status !== 200) r = await req('POST', '/api/v1/auth/login', { username: 'tahbiarmand', password: 'Carla2008' });
  let tok = r.body?.token;
  if (!tok) { console.log('login échoué:', r.status, r.body?.message); process.exit(1); }
  // Le compte doit changer son mdp ? alors en poser un nouveau pour la suite
  if (r.body?.utilisateur?.doit_changer_mdp) {
    const r2 = await req('POST', '/api/v1/auth/change-password', { ancien: 'Carla2008', nouveau: 'TestP2!2026' }, tok);
    t('changement mdp forcé', r2.status === 200);
    r = await req('POST', '/api/v1/auth/login', { username: 'tahbiarmand', password: 'TestP2!2026' });
    tok = r.body?.token;
  }
  t('login v1', Boolean(tok));

  // 1. Unités
  const u = await req('GET', '/api/v1/unites', null, tok);
  t('GET /v1/unites liste', u.status === 200 && u.body.length >= 32);
  const libre = u.body.find((x) => x.statut === 'libre');
  t('une unité libre existe', Boolean(libre));
  const uh = await req('GET', `/api/v1/unites/${libre.id}`, null, tok);
  t('historique unité (occupations)', uh.status === 200 && Array.isArray(uh.body.occupations));

  // 2. Occuper l'unité libre via contrat
  const c = await req('POST', '/api/v1/contrats', { unite_id: libre.id, nom_locataire: 'TEST LOCATAIRE', debut_suivi: '2026-10' }, tok);
  t('occuper unité libre', c.status === 201 && c.body.unite_id === libre.id && c.body.batiment_id === libre.batiment_id);
  const conflit = await req('POST', '/api/v1/contrats', { unite_id: libre.id, nom_locataire: 'DOUBLON', debut_suivi: '2026-10' }, tok);
  t('unité déjà occupée refusée (409)', conflit.status === 409);
  const cid = c.body?.id;

  // 3. Versement + quittance
  const v = await req('POST', '/api/v1/versements', { locataire_id: cid, mois: '2026-10', montant: 5000, mode: 'Espèces', cle_idempotence: 'test-p2-' + Date.now() }, tok);
  t('versement + quittance', v.status === 201 && /^Q-\d{4}-\d{6}$/.test(v.body?.numero_quittance || ''));

  // 4. Relances
  const rel = await req('GET', '/api/relances?mois=2026-10', null, tok);
  t('relances retournées', rel.status === 200 && Array.isArray(rel.body.relances) && typeof rel.body.total_dette === 'number');
  t('relance contient message + dette FCFA', rel.body.relances.every((x) => x.dette > 0 && x.message.includes('FCFA')));

  // 5. Clôture du mois 2026-10 puis blocages
  const cl = await req('POST', '/api/resumes/2026-10/cloturer', { remis_proprietaire: 1000000 }, tok);
  t('clôture du mois', cl.status === 200 && cl.body.cloture === true);
  const cl2 = await req('POST', '/api/resumes/2026-10/cloturer', {}, tok);
  t('double clôture refusée', cl2.status === 409);
  const vb = await req('POST', '/api/v1/versements', { locataire_id: cid, mois: '2026-10', montant: 1000 }, tok);
  t('versement sur mois clôturé refusé (409)', vb.status === 409 && vb.body.code === 'MOIS_CLOTURE');
  const db = await req('POST', '/api/depenses', { mois: '2026-10', designation: 'TEST', quantite: 1, montant_unitaire: 100 }, tok);
  t('dépense sur mois clôturé refusée', db.status === 409);
  const rb = await req('PUT', '/api/resumes/2026-10/remis', { montant: 5 }, tok);
  t('remis sur mois clôturé refusé', rb.status === 409);
  const ib = await req('POST', '/api/import/commit', { mois: '2026-10', batiments: [] }, tok);
  t('import sur mois clôturé refusé', ib.status === 409);
  const rsm = await req('GET', '/api/resumes/2026-10', null, tok);
  t('résumé clôturé figé (remis=1 000 000)', rsm.status === 200 && Number(rsm.body.montant_remis_au_proprietaire) === 1000000 && rsm.body.cloture === true);

  // 6. Départ sur mois clôturé refusé ; autre mois OK
  const dpb = await req('POST', `/api/locataires/${cid}/depart`, { mois_sortie: '2026-10' }, tok);
  t('départ sur mois clôturé refusé', dpb.status === 409);
  const dp = await req('POST', `/api/locataires/${cid}/depart`, { mois_sortie: '2026-11', porte_vide: true }, tok);
  t('départ + porte vide recréée', dp.status === 200 && dp.body.ok);
  const u2 = await req('GET', `/api/v1/unites/${libre.id}`, null, tok);
  t('unité libérée avec ligne Vide liée', u2.body.statut === undefined && u2.body.occupations.some((o) => o.nom_locataire === 'TEST LOCATAIRE'));

  // 7. Déclôture (admin) puis écriture à nouveau possible
  const dec = await req('POST', '/api/resumes/2026-10/decloturer', {}, tok);
  t('déclôture', dec.status === 200);
  const v2 = await req('POST', '/api/v1/versements', { locataire_id: cid, mois: '2026-10', montant: 1000 }, tok);
  t('versement après déclôture accepté', v2.status === 201);

  // 8. Vérifier le comptable ne peut pas déclôturer
  const rl = await req('POST', '/api/v1/auth/login', { username: 'comptable', password: 'TestCpt!2026' });
  if (rl.body?.utilisateur?.doit_changer_mdp) {
    await req('POST', '/api/v1/auth/change-password', { ancien: 'maeva2026', nouveau: 'TestCpt!2026' }, rl.body.token);
    const rl2 = await req('POST', '/api/v1/auth/login', { username: 'comptable', password: 'TestCpt!2026' });
    rl.body = rl2.body;
  }
  const dc = await req('POST', '/api/resumes/2026-10/decloturer', {}, rl.body?.token);
  t('déclôture refusée au comptable (403)', dc.status === 403);

  console.log(`\n${ok} réussis, ${ko} échoués`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
