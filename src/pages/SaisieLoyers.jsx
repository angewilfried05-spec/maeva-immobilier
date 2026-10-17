import React, { useState, useEffect } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

export default function SaisieLoyers({ data, reload, mois, setMois }) {
  const [enregistrement, setEnregistrement] = useState(false);
  const [modifs, setModifs] = useState({}); // { locataireId: { qte, note } }
  const [erreurs, setErreurs] = useState({});

  const paiementDe = (locId) =>
    data.paiements.find((p) => Number(p.locataire_id) === Number(locId));

  // Réinitialise les modifs locales quand les données changent
  useEffect(() => { setModifs({}); setErreurs({}); }, [data]);

  const qteCourante = (loc) => {
    const p = paiementDe(loc.id);
    const qteBase = p ? Number(p.quantite_mois_payee) || 0 : 0;
    return modifs[loc.id]?.qte !== undefined ? modifs[loc.id].qte : qteBase;
  };

  const noteCourante = (loc) => {
    const p = paiementDe(loc.id);
    const noteBase = p?.note || '';
    return modifs[loc.id]?.note !== undefined ? modifs[loc.id].note : noteBase;
  };

  const setQte = (loc, v) => {
    setModifs((m) => ({ ...m, [loc.id]: { ...(m[loc.id] || {}), qte: v } }));
  };

  const setNote = (loc, v) => {
    setModifs((m) => ({ ...m, [loc.id]: { ...(m[loc.id] || {}), note: v } }));
  };

  const enregistrer = async (loc) => {
    const m = modifs[loc.id];
    if (!m) return;
    setEnregistrement(true);
    try {
      const body = {
        locataire_id: loc.id, mois,
        montant_unitaire: loc.loyer_mensuel,
      };
      if (m.qte !== undefined) body.quantite_mois_payee = m.qte;
      if (m.note !== undefined) body.note = m.note;
      await api.put('/api/paiements', body);
      // Efface la modif locale pour cette ligne
      setModifs((mm) => {
        const copie = { ...mm };
        delete copie[loc.id];
        return copie;
      });
      await reload();
    } catch (e) {
      setErreurs((er) => ({ ...er, [loc.id]: e.message }));
    }
    setEnregistrement(false);
  };

  const enregistrerTout = async () => {
    const ids = Object.keys(modifs).map(Number);
    if (!ids.length) return;
    setEnregistrement(true);
    let nbErreurs = 0;
    for (const id of ids) {
      const loc = data.locataires.find((l) => Number(l.id) === Number(id));
      if (!loc) continue;
      const m = modifs[id];
      try {
        const body = { locataire_id: id, mois, montant_unitaire: loc.loyer_mensuel };
        if (m.qte !== undefined) body.quantite_mois_payee = m.qte;
        if (m.note !== undefined) body.note = m.note;
        await api.put('/api/paiements', body);
      } catch (e) { nbErreurs++; setErreurs((er) => ({ ...er, [id]: e.message })); }
    }
    setModifs({});
    await reload();
    setEnregistrement(false);
    if (nbErreurs > 0) alert(`${nbErreurs} erreur(s) lors de l'enregistrement`);
  };

  let totalGeneral = 0;
  const nbModifs = Object.keys(modifs).length;

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Saisie des loyers</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
        {enregistrement && <span style={{ color: 'var(--vert)', fontWeight: 700 }}>Enregistrement…</span>}
        {nbModifs > 0 && !enregistrement && (
          <button className="btn vert" onClick={enregistrerTout}>
            Enregistrer tout ({nbModifs})
          </button>
        )}
      </div>

      <table className="tableau">
        <thead>
          <tr>
            <th>Nom et prénom</th>
            <th className="num">Qté / mois</th>
            <th className="num">Mont. unit.</th>
            <th className="num">Mont. total</th>
            <th>Statut</th>
            <th>Note du mois</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.batiments.map((bat) => {
            const locs = data.locataires.filter(
              (l) => Number(l.batiment_id) === Number(bat.id) && l.statut !== 'Parti'
            );
            if (!locs.length) return null;
            return (
              <React.Fragment key={bat.id}>
                <tr className="groupe"><td colSpan={7}>{bat.nom}</td></tr>
                {locs.map((l) => {
                  const qte = qteCourante(l);
                  const note = noteCourante(l);
                  const total = Math.round(qte * (Number(l.loyer_mensuel) || 0));
                  totalGeneral += total;
                  const arr = data.arrieres_courants[l.id] || 0;
                  const modifie = !!modifs[l.id];
                  return (
                    <tr key={l.id} style={{ background: modifie ? '#fffbe6' : undefined }}>
                      <td><b>{l.numero_porte ? l.numero_porte + ' — ' : ''}{l.nom_locataire}</b></td>
                      <td className="num">
                        <input className="qte" type="number" min="0" step="0.5"
                          value={qte}
                          disabled={l.statut === 'Vide'}
                          onChange={(e) => setQte(l, Number(e.target.value) || 0)}
                          onKeyDown={(e) => { if (e.key === 'Enter') enregistrer(l); }}
                        />
                      </td>
                      <td className="num">{fcfa(l.loyer_mensuel)} F</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fcfa(total)} F</td>
                      <td>
                        {l.statut === 'Vide' ? <span className="badge vide">Vide</span>
                          : arr > 0 ? <span className="badge retard">Doit {arr} mois</span>
                          : qte > 1 ? <span className="badge avance">En avance</span>
                          : qte >= 1 ? <span className="badge ok">À jour</span>
                          : <span className="badge vide">—</span>}
                      </td>
                      <td>
                        <input style={{ width: '100%', fontSize: 14 }}
                          value={note}
                          placeholder="ex: PAYER 3 MOIS"
                          onChange={(e) => setNote(l, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') enregistrer(l); }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {modifie && (
                          <button className="btn petit vert" onClick={() => enregistrer(l)} disabled={enregistrement}>
                            ✓
                          </button>
                        )}
                        {erreurs[l.id] && <span title={erreurs[l.id]} style={{ color: 'var(--rouge)', marginLeft: 4 }}>⚠</span>}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          <tr className="groupe">
            <td colSpan={3}><b>TOTAL</b></td>
            <td className="num" style={{ fontSize: 18 }}><b>{fcfa(totalGeneral)} F</b></td>
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
      {data.batiments.length === 0 && (
        <div className="vide-note">Aucun bâtiment. Commencez par importer votre fichier Excel ou créez un bâtiment.</div>
      )}
      {nbModifs > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbe6', borderRadius: 8, fontSize: 14 }}>
          <b>{nbModifs}</b> modification(s) non enregistrée(s). Cliquez sur ✓ pour sauver une ligne,
          ou sur « Enregistrer tout » en haut.
        </div>
      )}
    </div>
  );
}
