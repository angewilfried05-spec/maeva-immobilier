import React, { useMemo, useState } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa, moisLabel } from '../utils/format.js';
import { api } from '../utils/api.js';

export default function Dashboard({ data, reload, mois, setMois, setPage }) {
  const [remisEdit, setRemisEdit] = useState(null);
  const [message, setMessage] = useState(null);

  const stats = useMemo(() => {
    const attendu = data.par_batiment.reduce((s, b) => s + b.attendu, 0);
    const percu = data.par_batiment.reduce((s, b) => s + b.percu, 0);
    const depenses = data.depenses.reduce((s, d) => s + (Number(d.montant_total) || 0), 0);
    return { attendu, percu, depenses, solde: percu - depenses };
  }, [data]);

  const remis = data.resume ? Number(data.resume.montant_remis_au_proprietaire) || 0 : 0;

  const exporterExcel = async () => {
    try {
      const r = await api.post('/api/export/rapport', { mois });
      setMessage({ type: 'succes', txt: `Rapport Excel créé : ${r.chemin}` });
    } catch (e) { setMessage({ type: 'erreur', txt: e.message }); }
  };

  const validerRemis = async () => {
    try {
      await api.put(`/api/resumes/${mois}/remis`, { montant: Number(remisEdit) || 0 });
      setRemisEdit(null); reload();
    } catch (e) { setMessage({ type: 'erreur', txt: e.message }); }
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Tableau de bord</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
        <button className="btn vert" onClick={exporterExcel}>Exporter Excel</button>
      </div>
      {message && <div className={`message ${message.type}`}>{message.txt}</div>}

      <div className="cartes">
        <div className="carte"><div className="libelle">Loyers attendus</div><div className="valeur">{fcfa(stats.attendu)} F</div></div>
        <div className="carte vert"><div className="libelle">Loyers perçus</div><div className="valeur">{fcfa(stats.percu)} F</div></div>
        <div className="carte orange"><div className="libelle">Dépenses</div><div className="valeur">{fcfa(stats.depenses)} F</div></div>
        <div className={`carte ${stats.solde >= 0 ? 'vert' : 'rouge'}`}><div className="libelle">Solde (restes)</div><div className="valeur">{fcfa(stats.solde)} F</div></div>
      </div>

      <div className="cartes">
        <div className="carte">
          <div className="libelle">Sommes remis au Boss — {moisLabel(mois)}</div>
          {remisEdit === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="valeur">{fcfa(remis)} F</div>
              <button className="btn petit" onClick={() => setRemisEdit(String(remis))}>Modifier</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="montant" autoFocus value={remisEdit}
                onChange={(e) => setRemisEdit(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') validerRemis(); }} />
              <button className="btn petit vert" onClick={validerRemis}>OK</button>
              <button className="btn petit gris" onClick={() => setRemisEdit(null)}>Annuler</button>
            </div>
          )}
        </div>
      </div>

      <h2>Par bâtiment</h2>
      <table className="tableau">
        <thead>
          <tr><th>Bâtiment</th><th className="num">Locataires actifs</th><th className="num">Attendu</th><th className="num">Perçu</th><th className="num">Reste</th></tr>
        </thead>
        <tbody>
          {data.par_batiment.map((b) => (
            <tr key={b.id}>
              <td><b>{b.nom}</b></td>
              <td className="num">{b.nb}</td>
              <td className="num">{fcfa(b.attendu)} F</td>
              <td className="num" style={{ color: 'var(--vert)', fontWeight: 700 }}>{fcfa(b.percu)} F</td>
              <td className="num" style={{ color: b.attendu - b.percu > 0 ? 'var(--rouge)' : 'inherit' }}>{fcfa(b.attendu - b.percu)} F</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 26 }}>
        Locataires en retard{' '}
        {data.en_retard.length > 0 && <span className="badge retard">{data.en_retard.length}</span>}
      </h2>
      {data.en_retard.length === 0 ? (
        <div className="vide-note">Aucun locataire en retard.</div>
      ) : (
        <table className="tableau">
          <thead><tr><th>Locataire</th><th>Bâtiment / Porte</th><th className="num">Loyer</th><th className="num">Mois de retard</th><th className="num">Montant dû</th></tr></thead>
          <tbody>
            {data.en_retard.map((l) => {
              const bat = data.batiments.find((b) => Number(b.id) === Number(l.batiment_id));
              return (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setPage('loyers')}>
                  <td><b>{l.nom_locataire}</b></td>
                  <td>{bat ? bat.nom : ''} {l.numero_porte || ''}</td>
                  <td className="num">{fcfa(l.loyer_mensuel)} F</td>
                  <td className="num"><span className="badge retard">{l.arrieres_mois} mois</span></td>
                  <td className="num" style={{ color: 'var(--rouge)', fontWeight: 700 }}>{fcfa(l.arrieres_mois * (Number(l.loyer_mensuel) || 0))} F</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
