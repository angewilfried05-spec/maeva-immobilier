import React, { useEffect, useState } from 'react';
import { fcfa, moisLabel } from '../utils/format.js';
import { api } from '../utils/api.js';

export default function Historique() {
  const [resumes, setResumes] = useState(null);
  const [message, setMessage] = useState(null);

  const reload = () => api.get('/api/resumes').then(setResumes).catch((e) => setMessage(e.message));
  useEffect(() => { reload(); }, []);

  const exporterExcel = async (mois) => {
    try { const r = await api.post('/api/export/rapport', { mois }); setMessage(`Rapport Excel créé : ${r.chemin}`); }
    catch (e) { setMessage(e.message); }
  };

  if (!resumes) return <div className="contenu"><p style={{ padding: 40 }}>Chargement…</p></div>;
  const list = [...resumes].sort((a, b) => String(b.mois).localeCompare(String(a.mois)));

  return (
    <div>
      <h2>Historique des mois</h2>
      {message && <div className="message succes">{message}</div>}
      {list.length === 0 ? (
        <div className="vide-note">Aucun mois enregistré pour le moment.</div>
      ) : (
        <table className="tableau">
          <thead>
            <tr><th>Mois</th><th className="num">Attendu</th><th className="num">Perçu</th><th className="num">Taux</th><th className="num">Dépenses</th><th className="num">Solde</th><th className="num">Remis au Boss</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const prev = list[i + 1];
              const evol = prev && Number(prev.total_loyers_percus)
                ? Math.round(((Number(r.total_loyers_percus) - Number(prev.total_loyers_percus)) / Number(prev.total_loyers_percus)) * 100) : null;
              const taux = Number(r.total_loyers_attendus)
                ? Math.round((Number(r.total_loyers_percus) / Number(r.total_loyers_attendus)) * 100) : 0;
              return (
                <tr key={r.mois}>
                  <td><b>{moisLabel(r.mois)}</b></td>
                  <td className="num">{fcfa(r.total_loyers_attendus)} F</td>
                  <td className="num" style={{ color: 'var(--vert)', fontWeight: 700 }}>
                    {fcfa(r.total_loyers_percus)} F
                    {evol !== null && (
                      <span style={{ fontSize: 12, marginLeft: 6, color: evol >= 0 ? 'var(--vert)' : 'var(--rouge)' }}>
                        ({evol >= 0 ? '+' : ''}{evol}%)
                      </span>
                    )}
                  </td>
                  <td className="num">{taux} %</td>
                  <td className="num">{fcfa(r.total_depenses)} F</td>
                  <td className="num" style={{ color: Number(r.solde) >= 0 ? 'inherit' : 'var(--rouge)', fontWeight: 700 }}>{fcfa(r.solde)} F</td>
                  <td className="num">{fcfa(r.montant_remis_au_proprietaire)} F</td>
                  <td><button className="btn petit" onClick={() => exporterExcel(r.mois)}>Excel</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
