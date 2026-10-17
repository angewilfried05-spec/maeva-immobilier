import React, { useState } from 'react';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';
import { HistoriquePaiements } from './Locataires.jsx';

export default function Recherche({ data }) {
  const [terme, setTerme] = useState('');
  const [selection, setSelection] = useState(null);
  const [histoData, setHistoData] = useState(null);

  const normaliser = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const resultats = terme.trim().length >= 2
    ? data.locataires.filter((l) => normaliser(l.nom_locataire).includes(normaliser(terme)))
    : [];

  const nomBat = (id) => data.batiments.find((b) => Number(b.id) === Number(id))?.nom || '';

  const voir = async (l) => {
    try { const d = await api.get(`/api/locataires/${l.id}`); setHistoData(d); setSelection(l); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <h2>Recherche d'un locataire</h2>
      <div className="barre">
        <input autoFocus style={{ flex: 1, maxWidth: 500, fontSize: 18, padding: '14px 16px' }}
          placeholder="Tapez le nom du locataire…"
          value={terme}
          onChange={(e) => { setTerme(e.target.value); setSelection(null); }}
        />
      </div>

      {terme.trim().length >= 2 && resultats.length === 0 && (
        <div className="vide-note">Aucun locataire trouvé pour « {terme} ».</div>
      )}

      {resultats.length > 0 && (
        <table className="tableau">
          <thead><tr><th>Nom</th><th>Bâtiment / Porte</th><th className="num">Loyer</th><th>Statut</th><th className="num">Retard</th><th></th></tr></thead>
          <tbody>
            {resultats.map((l) => (
              <tr key={l.id}>
                <td><b>{l.nom_locataire}</b></td>
                <td>{nomBat(l.batiment_id)} {l.numero_porte || ''}</td>
                <td className="num">{fcfa(l.loyer_mensuel)} F</td>
                <td>{l.statut}</td>
                <td className="num">{(data.arrieres_courants[l.id] || 0) > 0
                  ? <span className="badge retard">{data.arrieres_courants[l.id]} mois</span> : '—'}</td>
                <td><button className="btn petit" onClick={() => voir(l)}>Voir l'historique</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selection && histoData && (
        <div style={{ marginTop: 24 }}>
          <h2>Historique — {selection.nom_locataire}</h2>
          <HistoriquePaiements data={histoData} />
        </div>
      )}
    </div>
  );
}
