import React, { useMemo, useRef, useState } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa, moisLabel, situationBadge, aujourdhui } from '../utils/format.js';
import { api } from '../utils/api.js';

const MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];
const OBJETS = [
  ['loyer', 'Loyer'],
  ['arriere', 'Arriéré (dette)'],
  ['avance', "Avance"],
];

// Flux de caissier : rechercher un locataire → montant → quittance.
// Une clé d'idempotence est générée par encaissement affiché : renvoyer le
// formulaire ne crée jamais de doublon.
export default function Encaisser({ data, reload, mois, setMois }) {
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState(null);
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('Espèces');
  const [date, setDate] = useState(aujourdhui());
  const [note, setNote] = useState('');
  const [objet, setObjet] = useState('loyer');
  const [moisConcerne, setMoisConcerne] = useState(mois);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const cleRef = useRef(null);
  const champRecherche = useRef(null);

  const cloture = data.alertes?.mois_cloture;
  const actifs = useMemo(
    () => data.locataires.filter((l) => l.statut !== 'Vide'),
    [data.locataires]
  );
  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return [];
    return actifs
      .filter((l) => `${l.nom_locataire} ${l.numero_porte || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      .slice(0, 8);
  }, [recherche, actifs]);

  const sit = choisi ? data.situations[choisi.id] : null;
  const badge = choisi ? situationBadge(sit, choisi.statut) : null;

  const choisir = (l) => {
    setChoisi(l); setRecherche(''); setResultat(null); setErreur(null);
    setObjet('loyer'); setMoisConcerne(mois);
    cleRef.current = crypto.randomUUID();
    // Suggestion : la dette si elle existe, sinon un mois de loyer
    const s = data.situations[l.id];
    setMontant(String(s?.dette > 0 ? s.dette : s?.loyer || l.loyer_mensuel || ''));
    if (s?.dette > 0) setObjet('arriere');
  };

  const encaisser = async () => {
    const m = Math.round(Number(montant));
    if (!choisi || !(m > 0)) return;
    setEnCours(true); setErreur(null);
    try {
      const v = await api.post('/api/v1/versements', {
        locataire_id: choisi.id, mois: moisConcerne || mois, montant: m, date_versement: date,
        mode, note: note || undefined, type: objet, cle_idempotence: cleRef.current,
      });
      setResultat(v);
      reload();
    } catch (e) {
      setErreur(e.message);
    } finally { setEnCours(false); }
  };

  const nouveau = () => {
    setChoisi(null); setResultat(null); setMontant(''); setNote('');
    setObjet('loyer'); setMoisConcerne(mois);
    cleRef.current = null;
    champRecherche.current?.focus();
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Encaisser un loyer</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
      </div>
      {cloture && <div className="message erreur">Le mois {moisLabel(mois)} est clôturé : encaissement impossible.</div>}
      {erreur && <div className="message erreur">{erreur}</div>}

      {resultat ? (
        <div className="carte" style={{ maxWidth: 520 }}>
          <div className="message succes">
            Versement enregistré — quittance <b>{resultat.numero_quittance}</b>
          </div>
          <p style={{ fontSize: 15 }}>
            <b>{choisi.nom_locataire}</b> — {fcfa(resultat.montant)} F · {moisLabel(resultat.mois)} · {resultat.mode}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn vert" onClick={() => api.telecharger('GET', `/api/v1/versements/${resultat.id}/quittance`)}>
              Télécharger la quittance (PDF)
            </button>
            {choisi.telephone && (
              <a className="btn" target="_blank" rel="noreferrer"
                href={`https://wa.me/${String(choisi.telephone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Quittance ${resultat.numero_quittance} : ${fcfa(resultat.montant)} FCFA reçus pour ${moisLabel(resultat.mois)}. Merci. — MAEVA IMMOBILIER`)}`}>
                Envoyer par WhatsApp
              </a>
            )}
            <button className="btn gris" onClick={nouveau}>Nouvel encaissement</button>
          </div>
        </div>
      ) : (
        <div className="carte" style={{ maxWidth: 520 }}>
          {!choisi ? (
            <>
              <div className="champ">
                <label>Locataire (nom ou porte)</label>
                <input ref={champRecherche} autoFocus value={recherche}
                  placeholder="Commencez à taper un nom…"
                  onChange={(e) => setRecherche(e.target.value)} />
              </div>
              {resultats.length > 0 && (
                <div style={{ border: '1px solid var(--bord)', borderRadius: 8, marginTop: 6, overflow: 'hidden' }}>
                  {resultats.map((l) => {
                    const s = data.situations[l.id];
                    const b = situationBadge(s, l.statut);
                    return (
                      <button key={l.id} className="resultat-recherche" onClick={() => choisir(l)}>
                        <span><b>{l.nom_locataire}</b> <span style={{ color: '#7a8899' }}>{l.numero_porte || ''}</span></span>
                        <span className={`badge ${b.classe}`}>{b.texte}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <b style={{ fontSize: 17 }}>{choisi.nom_locataire}</b>
                  <span style={{ color: '#7a8899', marginLeft: 8 }}>{choisi.numero_porte || ''}</span>
                </div>
                {badge && <span className={`badge ${badge.classe}`}>{badge.texte}</span>}
                <button className="btn petit gris" onClick={nouveau}>Changer</button>
              </div>
              <div className="champ">
                <label>Montant reçu (FCFA)</label>
                <input className="montant" autoFocus inputMode="numeric" value={montant}
                  onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[1, 2, 3].map((n) => (
                  <button key={n} className="btn petit" onClick={() => setMontant(String((sit?.loyer || choisi.loyer_mensuel || 0) * n))}>
                    {n} mois
                  </button>
                ))}
                {sit?.dette > 0 && <button className="btn petit" onClick={() => setMontant(String(sit.dette))}>Solde dette</button>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="champ" style={{ flex: 1 }}>
                  <label>Objet</label>
                  <select value={objet} onChange={(e) => setObjet(e.target.value)}>
                    {OBJETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="champ" style={{ flex: 1 }}>
                  <label>Mois concerné</label>
                  <input type="month" value={moisConcerne} onChange={(e) => setMoisConcerne(e.target.value)} />
                </div>
              </div>
              {objet === 'arriere' && (
                <div style={{ fontSize: 13, color: '#5b6b7c', marginBottom: 8 }}>
                  Arriéré : le versement sera rattaché au mois choisi ci-dessus (ex. {moisLabel(moisConcerne)}).
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="champ" style={{ flex: 1 }}>
                  <label>Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    {MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="champ" style={{ flex: 1 }}>
                  <label>Date de paiement</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="champ"><label>Note (optionnel)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <button className="btn vert" style={{ width: '100%' }} disabled={enCours || cloture || !(Number(montant) > 0)} onClick={encaisser}>
                {enCours ? 'Enregistrement…' : `Encaisser ${montant ? fcfa(montant) + ' F' : ''}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
