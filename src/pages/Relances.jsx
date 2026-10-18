import React, { useEffect, useState } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa, fmtNombre, moisLabel, moisCourant } from '../utils/format.js';
import { api } from '../utils/api.js';

// Relances : locataires en dette avec message WhatsApp / SMS pré-rempli.
export default function Relances() {
  const [mois, setMois] = useState(moisCourant());
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.get(`/api/relances?mois=${mois}`).then(setData).catch((e) => setErreur(e.message));
  }, [mois]);

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Relances des locataires</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
      </div>
      {erreur && <div className="message erreur">{erreur}</div>}
      {!data ? <p>Chargement…</p> : data.relances.length === 0 ? (
        <div className="vide-note">Aucun locataire en dette sur {moisLabel(mois)}.</div>
      ) : (
        <>
          <div className="cartes">
            <div className="carte"><div className="libelle">Locataires à relancer</div><div className="valeur">{data.relances.length}</div></div>
            <div className="carte"><div className="libelle">Dette totale</div>
              <div className="valeur" style={{ color: 'var(--rouge)' }}>{fcfa(data.total_dette)} F</div></div>
          </div>
          <table className="tableau">
            <thead>
              <tr><th>Locataire</th><th>Bâtiment / Porte</th><th>Téléphone</th>
                <th className="num">Dette</th><th className="num">Équiv.</th><th>Relancer</th></tr>
            </thead>
            <tbody>
              {data.relances.map((r) => (
                <tr key={r.locataire_id}>
                  <td><b>{r.nom_locataire}</b></td>
                  <td>{r.batiment} {r.porte || ''}</td>
                  <td>{r.telephone || '—'}</td>
                  <td className="num" style={{ color: 'var(--rouge)', fontWeight: 700 }}>{fcfa(r.dette)} F</td>
                  <td className="num">{fmtNombre(r.dette_mois)} mois</td>
                  <td>
                    {r.whatsapp
                      ? <a className="btn petit vert" target="_blank" rel="noreferrer" href={r.whatsapp}>WhatsApp</a>
                      : <span style={{ color: '#7a8899' }}>pas de n°</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
