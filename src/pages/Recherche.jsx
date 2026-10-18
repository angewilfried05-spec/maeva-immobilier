import React, { useState } from 'react';
import Situation from '../components/Situation.jsx';
import { fcfa } from '../utils/format.js';
import { FicheLocataire } from './Locataires.jsx';

export default function Recherche({ data, mois }) {
  const [terme, setTerme] = useState('');
  const [selection, setSelection] = useState(null);

  const normaliser = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const resultats = terme.trim().length >= 2
    ? data.locataires.filter((l) => normaliser(l.nom_locataire).includes(normaliser(terme)))
    : [];

  const nomBat = (id) => data.batiments.find((b) => Number(b.id) === Number(id))?.nom || '';

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
          <thead><tr><th>Nom</th><th>Bâtiment / Porte</th><th className="num">Loyer</th><th>Statut</th><th>Situation</th><th></th></tr></thead>
          <tbody>
            {resultats.map((l) => (
              <tr key={l.id}>
                <td><b>{l.nom_locataire}</b></td>
                <td>{nomBat(l.batiment_id)} {l.numero_porte || ''}</td>
                <td className="num">{fcfa(l.loyer_mensuel)} F</td>
                <td>{l.statut}</td>
                <td><Situation sit={data.situations[l.id]} statut={l.statut} /></td>
                <td>{l.statut !== 'Vide' && <button className="btn petit" onClick={() => setSelection(l)}>Voir la fiche</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selection && (
        <div style={{ marginTop: 24 }}>
          <h2>Fiche — {selection.nom_locataire}</h2>
          <FicheLocataire id={selection.id} mois={mois} />
        </div>
      )}
    </div>
  );
}
