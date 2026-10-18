import React, { useEffect, useState } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import Modal from '../components/Modal.jsx';
import Situation from '../components/Situation.jsx';
import { fcfa, moisLabel, aujourdhui, dateFr } from '../utils/format.js';
import { api } from '../utils/api.js';

const MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];
const TYPES = { loyer: 'Loyer', avance: "Avance d'entrée", caution: 'Retenue caution' };

export default function SaisieLoyers({ data, reload, mois, setMois, utilisateur }) {
  const [montants, setMontants] = useState({}); // { locId: '50000' } versements à enregistrer
  const [notes, setNotes] = useState({});       // { locId: 'note' } notes modifiées
  const [dateVersement, setDateVersement] = useState(aujourdhui());
  const [mode, setMode] = useState('Espèces');
  const [enCours, setEnCours] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [detail, setDetail] = useState(null);   // locataire dont on affiche les versements du mois
  const lecture = utilisateur?.role === 'lecteur';

  useEffect(() => { setMontants({}); setNotes({}); setErreurs({}); }, [data]);

  const sit = (l) => data.situations[l.id];
  const visible = (l) => l.statut === 'Vide' || sit(l).loyer_du_mois > 0 || sit(l).recu_mois > 0;
  const anciensDebiteurs = data.locataires.filter((l) => l.statut === 'Parti' && !visible(l) && sit(l).dette > 0);
  const noteDe = (l) => (notes[l.id] !== undefined ? notes[l.id] : data.notes[l.id] || '');
  const modifie = (l) => Number(montants[l.id]) > 0 || notes[l.id] !== undefined;
  const nbModifs = data.locataires.filter(modifie).length;

  const enregistrerLigne = async (l) => {
    const montant = Number(montants[l.id]) || 0;
    if (montant > 0) {
      await api.post('/api/versements', { locataire_id: l.id, mois, montant, date_versement: dateVersement, mode });
    }
    if (notes[l.id] !== undefined) {
      await api.put('/api/versements/note', { locataire_id: l.id, mois, note: notes[l.id] });
    }
  };

  const enregistrer = async (liste) => {
    setEnCours(true);
    const err = {};
    for (const l of liste) {
      try { await enregistrerLigne(l); } catch (e) { err[l.id] = e.message; }
    }
    await reload();
    setErreurs(err);
    setEnCours(false);
    if (Object.keys(err).length) alert(`${Object.keys(err).length} erreur(s) lors de l'enregistrement`);
  };

  const ligne = (l) => {
    const s = sit(l);
    const loyer = s.loyer_du_mois || s.loyer || Number(l.loyer_mensuel) || 0;
    const vide = l.statut === 'Vide';
    const remplir = (v) => setMontants((m) => ({ ...m, [l.id]: String(v) }));
    return (
      <tr key={l.id} style={{ background: modifie(l) ? '#fffbe6' : undefined }}>
        <td>
          <b>{l.numero_porte ? l.numero_porte + ' — ' : ''}{l.nom_locataire}</b>
          {l.statut === 'Parti' && <div style={{ fontSize: 12, color: '#7a8899' }}>Parti fin {moisLabel(l.mois_sortie)}</div>}
        </td>
        <td className="num">{fcfa(loyer)} F</td>
        <td className="num" style={{ fontWeight: 700, color: s.recu_mois > 0 ? 'var(--vert)' : '#9aa6b2' }}>
          {fcfa(s.recu_mois)} F
        </td>
        <td><Situation sit={s} statut={l.statut} /></td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {!vide && !lecture && (
            <>
              <input className="montant" type="number" min="0" placeholder="Montant" style={{ width: 120, padding: '7px 9px' }}
                value={montants[l.id] || ''}
                onChange={(e) => setMontants((m) => ({ ...m, [l.id]: e.target.value.replace(/[^\d]/g, '') }))}
                onKeyDown={(e) => { if (e.key === 'Enter') enregistrer([l]); }} />
              {[1, 2, 3].map((n) => (
                <button key={n} className="btn petit gris" style={{ marginLeft: 4, padding: '6px 9px' }}
                  title={`${n} mois = ${fcfa(n * loyer)} F`} onClick={() => remplir(n * loyer)}>{n}m</button>
              ))}
              {s.dette > 0 && (
                <button className="btn petit gris" style={{ marginLeft: 4, padding: '6px 9px' }}
                  title={`Solder la dette : ${fcfa(s.dette)} F`} onClick={() => remplir(s.dette)}>Dette</button>
              )}
            </>
          )}
        </td>
        <td>
          {!vide && (
            <input style={{ width: '100%', fontSize: 14, padding: '7px 9px' }} value={noteDe(l)} disabled={lecture}
              placeholder="ex: VA PAYER LE 15"
              onChange={(e) => setNotes((n) => ({ ...n, [l.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') enregistrer([l]); }} />
          )}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {modifie(l) && <button className="btn petit vert" onClick={() => enregistrer([l])} disabled={enCours}>✓</button>}{' '}
          {!vide && <button className="btn petit" onClick={() => setDetail(l)}>Détail</button>}
          {erreurs[l.id] && <span title={erreurs[l.id]} style={{ color: 'var(--rouge)', marginLeft: 4 }}>⚠</span>}
        </td>
      </tr>
    );
  };

  const totalAttendu = data.locataires.reduce((s, l) => s + sit(l).loyer_du_mois, 0);
  const totalRecu = data.versements.reduce((s, v) => s + v.montant, 0);
  const entete = (
    <tr>
      <th>Nom et prénom</th><th className="num">Loyer</th><th className="num">Reçu ce mois</th>
      <th>Situation</th><th>Encaisser</th><th>Note du mois</th><th></th>
    </tr>
  );

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Saisie des loyers</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
        {!lecture && (
          <>
            <label style={{ fontSize: 14, fontWeight: 600 }}>Date
              <input type="date" value={dateVersement} onChange={(e) => setDateVersement(e.target.value)} style={{ marginLeft: 6, padding: '7px 9px' }} />
            </label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ padding: '7px 9px' }}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </>
        )}
        {enCours && <span style={{ color: 'var(--vert)', fontWeight: 700 }}>Enregistrement…</span>}
        {nbModifs > 0 && !enCours && (
          <button className="btn vert" onClick={() => enregistrer(data.locataires.filter(modifie))}>Enregistrer tout ({nbModifs})</button>
        )}
      </div>

      <table className="tableau">
        <thead>{entete}</thead>
        <tbody>
          {data.batiments.map((bat) => {
            const locs = data.locataires.filter((l) => Number(l.batiment_id) === Number(bat.id) && visible(l));
            if (!locs.length) return null;
            return (
              <React.Fragment key={bat.id}>
                <tr className="groupe"><td colSpan={7}>{bat.nom}</td></tr>
                {locs.map(ligne)}
              </React.Fragment>
            );
          })}
          {anciensDebiteurs.length > 0 && (
            <>
              <tr className="groupe"><td colSpan={7}>Anciens locataires avec dette</td></tr>
              {anciensDebiteurs.map(ligne)}
            </>
          )}
          <tr className="groupe">
            <td><b>TOTAL</b></td>
            <td className="num"><b>{fcfa(totalAttendu)} F</b></td>
            <td className="num" style={{ fontSize: 18 }}><b>{fcfa(totalRecu)} F</b></td>
            <td colSpan={4}></td>
          </tr>
        </tbody>
      </table>
      {data.batiments.length === 0 && (
        <div className="vide-note">Aucun bâtiment. Commencez par importer votre fichier Excel ou créez un bâtiment.</div>
      )}
      {nbModifs > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbe6', borderRadius: 8, fontSize: 14 }}>
          <b>{nbModifs}</b> ligne(s) non enregistrée(s). Cliquez sur ✓ ou appuyez sur Entrée pour une ligne,
          ou sur « Enregistrer tout » en haut. Les versements seront datés du <b>{dateFr(dateVersement)}</b> ({mode}).
        </div>
      )}

      {detail && (
        <DetailVersements locataire={detail} mois={mois} data={data} lecture={lecture}
          admin={utilisateur?.role === 'admin'}
          onFermer={() => setDetail(null)} reload={reload} />
      )}
    </div>
  );
}

function DetailVersements({ locataire, mois, data, lecture, admin, onFermer, reload }) {
  const vide = { montant: '', date_versement: aujourdhui(), mode: 'Espèces', note: '' };
  const [form, setForm] = useState(vide);
  const [erreur, setErreur] = useState(null);
  const versements = data.versements.filter((v) => v.locataire_id === locataire.id);
  const s = data.situations[locataire.id];

  const ajouter = async () => {
    setErreur(null);
    try {
      await api.post('/api/versements', { ...form, locataire_id: locataire.id, mois, montant: Number(form.montant) });
      setForm(vide); await reload();
    } catch (e) { setErreur(e.message); }
  };

  const supprimer = async (v) => {
    if (!window.confirm(`Annuler le versement de ${fcfa(v.montant)} F du ${dateFr(v.date_versement)}${v.numero_quittance ? ` (quittance ${v.numero_quittance})` : ''} ?`)) return;
    const motif = window.prompt('Motif de l\'annulation (optionnel) :') || '';
    try { await api.del(`/api/versements/${v.id}`, { motif }); await reload(); } catch (e) { setErreur(e.message); }
  };

  return (
    <Modal titre={`${locataire.nom_locataire} — ${moisLabel(mois)}`} onFermer={onFermer}>
      <div style={{ marginBottom: 12 }}><Situation sit={s} statut={locataire.statut} /></div>
      {erreur && <div className="message erreur">{erreur}</div>}
      {versements.length === 0 ? (
        <div className="vide-note" style={{ padding: 14 }}>Aucun versement ce mois-ci.</div>
      ) : (
        <table className="tableau">
          <thead><tr><th>Date</th><th className="num">Montant</th><th>Mode</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {versements.map((v) => (
              <tr key={v.id}>
                <td>{dateFr(v.date_versement)}</td>
                <td className="num"><b>{fcfa(v.montant)} F</b></td>
                <td>{v.mode}{v.type !== 'loyer' && <div style={{ fontSize: 12, color: '#7a8899' }}>{TYPES[v.type]}</div>}</td>
                <td style={{ fontSize: 13 }}>{v.note || ''}</td>
                <td>{admin && <button className="btn petit rouge" title="Annuler ce versement" onClick={() => supprimer(v)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!lecture && (
        <>
          <h3 style={{ marginTop: 18, fontSize: 16 }}>Ajouter un versement</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="champ"><label>Montant (FCFA)</label>
              <input type="number" min="0" autoFocus value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} /></div>
            <div className="champ"><label>Date</label>
              <input type="date" value={form.date_versement} onChange={(e) => setForm({ ...form, date_versement: e.target.value })} /></div>
            <div className="champ"><label>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {MODES.map((m) => <option key={m}>{m}</option>)}
              </select></div>
            <div className="champ"><label>Note (optionnel)</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
        </>
      )}
      <div className="actions">
        <button className="btn gris" onClick={onFermer}>Fermer</button>
        {!lecture && <button className="btn vert" onClick={ajouter} disabled={!(Number(form.montant) > 0)}>Ajouter</button>}
      </div>
    </Modal>
  );
}
