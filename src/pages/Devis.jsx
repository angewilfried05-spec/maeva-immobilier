import React, { useEffect, useState } from 'react';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

const STATUTS = ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Facturé'];
const STATUT_COULEUR = {
  Brouillon: 'vide', Envoyé: 'avance', Accepté: 'ok', Refusé: 'retard', Facturé: 'ok',
};

export default function Devis({ setPage }) {
  const [liste, setListe] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState(null);

  const reload = async () => {
    try {
      const params = new URLSearchParams();
      if (filtreStatut) params.set('statut', filtreStatut);
      if (recherche) params.set('q', recherche);
      const r = await api.get('/api/devis' + (params.toString() ? '?' + params.toString() : ''));
      setListe(r);
    } catch (e) { setMessage(e.message); }
  };

  useEffect(() => { reload(); }, [filtreStatut, recherche]);

  const changerStatut = async (d, statut) => {
    try { await api.put(`/api/devis/${d.id}/statut`, { statut }); reload(); }
    catch (e) { alert(e.message); }
  };

  const dupliquer = async (d) => {
    try { const r = await api.post(`/api/devis/${d.id}/dupliquer`); reload(); setMessage(`Devis dupliqué (n° ${r.id})`); }
    catch (e) { alert(e.message); }
  };

  const supprimer = async (d) => {
    if (!window.confirm(`Supprimer le devis ${d.numero} ?`)) return;
    try { await api.del(`/api/devis/${d.id}`); reload(); }
    catch (e) { alert(e.message); }
  };

  const exporter = async (d, format) => {
    try {
      const nom = await api.telecharger('POST', `/api/devis/${d.id}/export`, { format });
      setMessage(`${format.toUpperCase()} téléchargé : ${nom}`);
    } catch (e) { alert(e.message); }
  };

  if (!liste) return <div><p style={{ padding: 40 }}>Chargement…</p></div>;

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Devis BTP</h2>
        <input placeholder="Rechercher (n°, objet, client)…" value={recherche}
          onChange={(e) => setRecherche(e.target.value)} style={{ width: 280 }} />
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {STATUTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn vert" onClick={() => setPage('/devis/nouveau')}>+ Nouveau devis</button>
      </div>
      {message && <div className="message succes">{message}</div>}

      {liste.length === 0 ? (
        <div className="vide-note">Aucun devis. Cliquez sur « + Nouveau devis » pour commencer.</div>
      ) : (
        <table className="tableau">
          <thead>
            <tr>
              <th>N°</th><th>Date</th><th>Objet</th><th>Client</th>
              <th className="num">Total</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((d) => (
              <tr key={d.id}>
                <td><b>{d.numero}</b></td>
                <td>{d.date ? String(d.date).slice(0, 10).split('-').reverse().join('/') : '—'}</td>
                <td>{d.titre_objet}</td>
                <td>{d.client_nom || '—'}</td>
                <td className="num" style={{ fontWeight: 700 }}>{fcfa(d.total_general)} F</td>
                <td>
                  <select value={d.statut} onChange={(e) => changerStatut(d, e.target.value)}
                    style={{ fontSize: 13, padding: '2px 6px' }}>
                    {STATUTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn petit" onClick={() => setPage(`/devis/${d.id}`)}>Ouvrir</button>{' '}
                  <button className="btn petit" onClick={() => exporter(d, 'docx')} title="Exporter Word">W</button>{' '}
                  <button className="btn petit" onClick={() => exporter(d, 'pdf')} title="Exporter PDF">P</button>{' '}
                  <button className="btn petit" onClick={() => dupliquer(d)} title="Dupliquer">⎘</button>{' '}
                  <button className="btn petit rouge" onClick={() => supprimer(d)}>Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
