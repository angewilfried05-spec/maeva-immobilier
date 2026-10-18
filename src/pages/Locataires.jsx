import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Situation from '../components/Situation.jsx';
import { fcfa, fmtNombre, moisLabel, moisCourant, dateFr } from '../utils/format.js';
import { api } from '../utils/api.js';

const VIDE = {
  numero_porte: '', nom_locataire: '', loyer_mensuel: '', date_entree: '', statut: 'Actif', telephone: '', note: '',
  debut_suivi: '', solde_initial: 0, caution: 0, avance: 0,
};
const TYPES = { loyer: 'Loyer', avance: "Avance d'entrée", caution: 'Retenue sur caution' };

const equivalentMois = (montant, loyer) => (Number(loyer) > 0 && Number(montant) > 0
  ? ` = ${fmtNombre(Math.round((Number(montant) / Number(loyer)) * 10) / 10)} mois` : '');

export default function Locataires({ data, reload, mois }) {
  const [filtreBat, setFiltreBat] = useState('');
  const [voirPartis, setVoirPartis] = useState(false);
  const [edition, setEdition] = useState(null);
  const [depart, setDepart] = useState(null);
  const [fiche, setFiche] = useState(null);

  const locs = data.locataires
    .filter((l) => !filtreBat || Number(l.batiment_id) === Number(filtreBat))
    .filter((l) => voirPartis || l.statut !== 'Parti');
  const nbPartis = data.locataires.filter((l) => l.statut === 'Parti').length;
  const nomBat = (id) => data.batiments.find((b) => Number(b.id) === Number(id))?.nom || '';

  const supprimer = async (l) => {
    if (!window.confirm(`Supprimer définitivement "${l.nom_locataire}" et tout son historique de versements ?\n\nPour un locataire qui s'en va, utilisez plutôt « Départ ».`)) return;
    try { await api.del(`/api/locataires/${l.id}`); reload(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Locataires</h2>
        <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={voirPartis} onChange={(e) => setVoirPartis(e.target.checked)} />
          Anciens locataires ({nbPartis})
        </label>
        <select value={filtreBat} onChange={(e) => setFiltreBat(e.target.value)}>
          <option value="">Tous les bâtiments</option>
          {data.batiments.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </select>
        <button className="btn vert" onClick={() => setEdition({ ...VIDE, batiment_id: filtreBat || data.batiments[0]?.id || '' })}>
          + Ajouter un locataire
        </button>
      </div>

      <table className="tableau">
        <thead><tr><th>Bâtiment</th><th>Porte</th><th>Nom</th><th className="num">Loyer</th><th>Situation ({moisLabel(mois)})</th><th className="num">Caution</th><th>Téléphone</th><th></th></tr></thead>
        <tbody>
          {locs.map((l) => (
            <tr key={l.id} style={{ opacity: l.statut === 'Parti' ? 0.75 : 1 }}>
              <td>{nomBat(l.batiment_id)}</td>
              <td>{l.numero_porte || '—'}</td>
              <td>
                <b>{l.nom_locataire}</b>
                {l.statut === 'Parti' && <div style={{ fontSize: 13, color: '#7a8899' }}>Parti fin {moisLabel(l.mois_sortie)}</div>}
                {l.statut === 'Actif' && l.debut_suivi && <div style={{ fontSize: 13, color: '#7a8899' }}>Suivi depuis {moisLabel(l.debut_suivi)}</div>}
                {l.note ? <div style={{ fontSize: 13, color: '#7a8899' }}>{l.note}</div> : null}
              </td>
              <td className="num">{fcfa(l.loyer_mensuel)} F</td>
              <td><Situation sit={data.situations[l.id]} statut={l.statut} /></td>
              <td className="num">{l.caution ? `${fcfa(l.caution)} F` : '—'}</td>
              <td>{l.telephone || '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {l.statut !== 'Vide' && <><button className="btn petit" onClick={() => setFiche(l)}>Fiche</button>{' '}</>}
                <button className="btn petit" onClick={() => setEdition({ ...VIDE, ...l, avance: 0, loyer_initial: l.loyer_mensuel, statut_initial: l.statut })}>Modifier</button>{' '}
                {l.statut === 'Actif' && <><button className="btn petit gris" onClick={() => setDepart(l)}>Départ</button>{' '}</>}
                <button className="btn petit rouge" onClick={() => supprimer(l)}>Suppr.</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {locs.length === 0 && <div className="vide-note">Aucun locataire.</div>}

      {edition && <EditionLocataire edition={edition} setEdition={setEdition} data={data} reload={reload} />}
      {depart && <Depart locataire={depart} mois={mois} onFermer={() => setDepart(null)} reload={reload} />}
      {fiche && (
        <Modal titre={`Fiche — ${fiche.nom_locataire}`} onFermer={() => setFiche(null)}>
          <FicheLocataire id={fiche.id} mois={mois} />
          <div className="actions"><button className="btn" onClick={() => setFiche(null)}>Fermer</button></div>
        </Modal>
      )}
    </div>
  );
}

function EditionLocataire({ edition, setEdition, data, reload }) {
  const [erreur, setErreur] = useState(null);
  const maj = (champ, v) => setEdition({ ...edition, [champ]: v });
  const nouveau = !edition.id;
  const initial = edition.statut_initial;
  const ouvreCompte = edition.statut === 'Actif' && (nouveau || initial === 'Vide');
  const loyerChange = !nouveau && initial === 'Actif' && Number(edition.loyer_mensuel) !== Number(edition.loyer_initial);
  const statuts = nouveau ? ['Actif', 'Vide'] : initial === 'Vide' ? ['Vide', 'Actif'] : initial === 'Parti' ? ['Parti', 'Actif'] : ['Actif'];

  const enregistrer = async () => {
    if (!String(edition.nom_locataire).trim() || !edition.batiment_id) { setErreur('Bâtiment et nom requis'); return; }
    try {
      const body = {
        batiment_id: Number(edition.batiment_id), numero_porte: edition.numero_porte, nom_locataire: edition.nom_locataire,
        loyer_mensuel: Number(edition.loyer_mensuel) || 0, statut: edition.statut, telephone: edition.telephone, note: edition.note,
        date_entree: edition.date_entree ? String(edition.date_entree).slice(0, 10) : '',
        debut_suivi: edition.debut_suivi || '', solde_initial: Number(edition.solde_initial) || 0,
        caution: Number(edition.caution) || 0, avance: Number(edition.avance) || 0,
        loyer_a_partir_de: edition.loyer_a_partir_de || moisCourant(),
      };
      if (edition.id) await api.put(`/api/locataires/${edition.id}`, body);
      else await api.post('/api/locataires', body);
      setEdition(null); reload();
    } catch (e) { setErreur(e.message); }
  };

  return (
    <Modal titre={nouveau ? 'Nouveau locataire' : initial === 'Vide' ? 'Porte vide' : 'Modifier le locataire'} onFermer={() => setEdition(null)}>
      {erreur && <div className="message erreur">{erreur}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div className="champ"><label>Bâtiment</label>
          <select value={edition.batiment_id} onChange={(e) => maj('batiment_id', e.target.value)}>
            {data.batiments.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select></div>
        <div className="champ"><label>Numéro de porte</label>
          <input value={edition.numero_porte || ''} placeholder="PORTE 1, P3…" onChange={(e) => maj('numero_porte', e.target.value)} /></div>
        <div className="champ" style={{ gridColumn: '1 / 3' }}><label>Nom et prénom</label>
          <input autoFocus value={edition.nom_locataire} onChange={(e) => maj('nom_locataire', e.target.value)} /></div>
        <div className="champ"><label>Loyer mensuel (FCFA)</label>
          <input type="number" value={edition.loyer_mensuel} onChange={(e) => maj('loyer_mensuel', e.target.value)} /></div>
        <div className="champ"><label>Statut</label>
          <select value={edition.statut} onChange={(e) => maj('statut', e.target.value)} disabled={statuts.length === 1}>
            {statuts.map((s) => <option key={s} value={s}>{s === 'Vide' ? 'Porte vide' : s === 'Actif' && initial === 'Parti' ? 'Actif (annuler le départ)' : s}</option>)}
          </select></div>
      </div>

      {loyerChange && (
        <div className="champ" style={{ background: '#fffbe6', padding: 10, borderRadius: 8 }}>
          <label>Nouveau loyer applicable à partir de</label>
          <input type="month" value={edition.loyer_a_partir_de || moisCourant()} onChange={(e) => maj('loyer_a_partir_de', e.target.value)} />
          <span style={{ fontSize: 13, color: '#5b6b7c' }}>Les mois précédents restent dus à {fcfa(edition.loyer_initial)} F.</span>
        </div>
      )}

      {edition.statut === 'Actif' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <div className="champ"><label>Date d'entrée</label>
            <input type="date" value={edition.date_entree ? String(edition.date_entree).slice(0, 10) : ''}
              onChange={(e) => setEdition({ ...edition, date_entree: e.target.value, debut_suivi: e.target.value ? e.target.value.slice(0, 7) : edition.debut_suivi })} /></div>
          <div className="champ"><label>Premier mois dû</label>
            <input type="month" value={edition.debut_suivi || ''} onChange={(e) => maj('debut_suivi', e.target.value)} /></div>
          <div className="champ"><label>Caution versée (FCFA){equivalentMois(edition.caution, edition.loyer_mensuel)}</label>
            <input type="number" min="0" value={edition.caution} onChange={(e) => maj('caution', e.target.value)} /></div>
          {ouvreCompte ? (
            <div className="champ"><label>Avance versée (FCFA){equivalentMois(edition.avance, edition.loyer_mensuel)}</label>
              <input type="number" min="0" value={edition.avance} onChange={(e) => maj('avance', e.target.value)} /></div>
          ) : <div />}
          <div className="champ" style={{ gridColumn: '1 / 3' }}>
            <label>Dette antérieure au premier mois dû (FCFA){equivalentMois(edition.solde_initial, edition.loyer_mensuel)}</label>
            <input type="number" min="0" value={edition.solde_initial} onChange={(e) => maj('solde_initial', e.target.value)} /></div>
        </div>
      )}
      {ouvreCompte && (
        <div style={{ fontSize: 13, color: '#5b6b7c', marginBottom: 10 }}>
          L'avance est enregistrée comme un versement du premier mois dû et couvre automatiquement les mois suivants.
          La caution est conservée à part et sera déduite de la dette au départ.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div className="champ"><label>Téléphone</label>
          <input value={edition.telephone || ''} onChange={(e) => maj('telephone', e.target.value)} /></div>
        <div className="champ"><label>Note libre</label>
          <input value={edition.note || ''} onChange={(e) => maj('note', e.target.value)} /></div>
      </div>
      <div className="actions">
        <button className="btn gris" onClick={() => setEdition(null)}>Annuler</button>
        <button className="btn vert" onClick={enregistrer}>Enregistrer</button>
      </div>
    </Modal>
  );
}

function Depart({ locataire, mois, onFermer, reload }) {
  const [moisSortie, setMoisSortie] = useState(mois);
  const [apercu, setApercu] = useState(null);
  const [retenue, setRetenue] = useState(0);
  const [remboursement, setRemboursement] = useState(0);
  const [depense, setDepense] = useState(true);
  const [porteVide, setPorteVide] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.get(`/api/locataires/${locataire.id}/depart-apercu?mois=${moisSortie}`).then((a) => {
      const r = Math.min(a.caution, a.situation.dette);
      setApercu(a); setRetenue(r); setRemboursement(a.caution - r); setErreur(null);
    }).catch((e) => setErreur(e.message));
  }, [moisSortie, locataire.id]);

  const valider = async () => {
    try {
      await api.post(`/api/locataires/${locataire.id}/depart`, {
        mois_sortie: moisSortie, retenue, remboursement, depense_remboursement: depense, porte_vide: porteVide,
      });
      onFermer(); reload();
    } catch (e) { setErreur(e.message); }
  };

  const s = apercu?.situation;
  return (
    <Modal titre={`Départ — ${locataire.nom_locataire}`} onFermer={onFermer}>
      {erreur && <div className="message erreur">{erreur}</div>}
      <div className="champ"><label>Dernier mois dû (mois de sortie)</label>
        <input type="month" value={moisSortie} onChange={(e) => setMoisSortie(e.target.value)} /></div>
      {apercu && (
        <>
          <table className="tableau" style={{ marginBottom: 14 }}>
            <tbody>
              <tr><td>Dette à la fin de {moisLabel(moisSortie)}</td><td className="num"><b style={{ color: s.dette > 0 ? 'var(--rouge)' : 'inherit' }}>{fcfa(s.dette)} F</b></td></tr>
              {s.avance > 0 && <tr><td>Avance non consommée</td><td className="num">{fcfa(s.avance)} F</td></tr>}
              <tr><td>Caution détenue</td><td className="num"><b>{fcfa(apercu.caution)} F</b></td></tr>
            </tbody>
          </table>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div className="champ"><label>Retenue sur caution (FCFA)</label>
              <input type="number" min="0" max={Math.min(apercu.caution, s.dette)} value={retenue}
                onChange={(e) => { const r = Number(e.target.value) || 0; setRetenue(r); setRemboursement(Math.max(0, apercu.caution - r)); }} /></div>
            <div className="champ"><label>Caution remboursée (FCFA)</label>
              <input type="number" min="0" value={remboursement} onChange={(e) => setRemboursement(Number(e.target.value) || 0)} /></div>
          </div>
          <div style={{ padding: 10, background: '#eef3fa', borderRadius: 8, fontSize: 14, marginBottom: 12 }}>
            Reste dû après départ : <b style={{ color: s.dette - retenue > 0 ? 'var(--rouge)' : 'var(--vert)' }}>{fcfa(Math.max(0, s.dette - retenue))} F</b>
            {s.dette - retenue > 0 && <> — restera visible dans « Anciens locataires avec dette » pour encaissement ultérieur.</>}
            {s.avance > 0 && <> — l'avance non consommée ({fcfa(s.avance)} F) est à rembourser à part si besoin.</>}
          </div>
          <label className="souvenir-ligne">
            <input type="checkbox" checked={depense} onChange={(e) => setDepense(e.target.checked)} />
            Enregistrer le remboursement de caution en dépense ({moisLabel(moisSortie)})
          </label>
          <label className="souvenir-ligne">
            <input type="checkbox" checked={porteVide} onChange={(e) => setPorteVide(e.target.checked)} />
            Remettre la porte {locataire.numero_porte || ''} comme « porte vide »
          </label>
        </>
      )}
      <div className="actions">
        <button className="btn gris" onClick={onFermer}>Annuler</button>
        <button className="btn rouge" onClick={valider} disabled={!apercu}>Confirmer le départ</button>
      </div>
    </Modal>
  );
}

export function FicheLocataire({ id, mois }) {
  const [f, setF] = useState(null);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { api.get(`/api/locataires/${id}?mois=${mois}`).then(setF).catch((e) => setErreur(e.message)); }, [id, mois]);
  if (erreur) return <div className="message erreur">{erreur}</div>;
  if (!f) return <p>Chargement…</p>;
  const s = f.situation;
  return (
    <div>
      <div style={{ marginBottom: 12 }}><Situation sit={s} statut={f.statut} /></div>
      <table className="tableau" style={{ marginBottom: 16 }}>
        <tbody>
          <tr><td>Premier mois dû</td><td>{f.debut_suivi ? moisLabel(f.debut_suivi) : '—'}{f.mois_sortie ? ` → ${moisLabel(f.mois_sortie)}` : ''}</td></tr>
          <tr><td>Total dû à fin {moisLabel(mois)}</td><td className="num">{fcfa(s.du)} F</td></tr>
          <tr><td>Total versé</td><td className="num">{fcfa(s.verse)} F</td></tr>
          {f.solde_initial > 0 && <tr><td>dont dette antérieure</td><td className="num">{fcfa(f.solde_initial)} F</td></tr>}
          <tr><td>Caution</td><td className="num">{fcfa(f.caution)} F
            {f.statut === 'Parti' && ` (retenue ${fcfa(f.caution_retenue)} F, remboursée ${fcfa(f.caution_remboursee)} F)`}</td></tr>
          <tr><td>Loyers</td><td>{f.loyers.map((l) => `${fcfa(l.montant)} F dès ${moisLabel(l.a_partir_de)}`).join(' · ')}</td></tr>
        </tbody>
      </table>
      <h3 style={{ fontSize: 16 }}>Versements</h3>
      {f.versements.length === 0 ? <div className="vide-note" style={{ padding: 14 }}>Aucun versement enregistré.</div> : (
        <table className="tableau">
          <thead><tr><th>Mois</th><th>Date</th><th className="num">Montant</th><th>Type / mode</th><th>Note</th></tr></thead>
          <tbody>
            {f.versements.map((v) => (
              <tr key={v.id}>
                <td>{moisLabel(v.mois)}</td>
                <td>{dateFr(v.date_versement)}</td>
                <td className="num"><b>{fcfa(v.montant)} F</b></td>
                <td>{TYPES[v.type]} · {v.mode}</td>
                <td style={{ fontSize: 13 }}>{v.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {f.notes.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, marginTop: 14 }}>Notes mensuelles</h3>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {f.notes.map((n) => <li key={n.mois}><b>{moisLabel(n.mois)}</b> : {n.note}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
