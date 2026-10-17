import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

export default function Batiments({ data, reload }) {
  const [edition, setEdition] = useState(null);

  const enregistrer = async () => {
    if (!edition.nom || !edition.nom.trim()) return;
    try {
      if (edition.id) await api.put(`/api/batiments/${edition.id}`, { nom: edition.nom, adresse: edition.adresse, note: edition.note });
      else await api.post('/api/batiments', { nom: edition.nom, adresse: edition.adresse, note: edition.note });
      setEdition(null); reload();
    } catch (e) { alert(e.message); }
  };

  const supprimer = async (b) => {
    const nb = data.locataires.filter((l) => Number(l.batiment_id) === Number(b.id)).length;
    if (!window.confirm(`Supprimer le bâtiment "${b.nom}" ?\n${nb} locataire(s) et leurs paiements seront aussi supprimés.`)) return;
    try { await api.del(`/api/batiments/${b.id}`); reload(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Bâtiments</h2>
        <button className="btn vert" onClick={() => setEdition({ nom: '', adresse: '', note: '' })}>+ Ajouter un bâtiment</button>
      </div>

      <table className="tableau">
        <thead><tr><th>Nom</th><th>Adresse</th><th className="num">Locataires</th><th className="num">Loyers mensuels</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {data.batiments.map((b) => {
            const locs = data.locataires.filter((l) => Number(l.batiment_id) === Number(b.id) && l.statut === 'Actif');
            const total = locs.reduce((s, l) => s + (Number(l.loyer_mensuel) || 0), 0);
            return (
              <tr key={b.id}>
                <td><b>{b.nom}</b></td>
                <td>{b.adresse || '—'}</td>
                <td className="num">{locs.length}</td>
                <td className="num">{fcfa(total)} F</td>
                <td>{b.note || ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn petit" onClick={() => setEdition({ ...b })}>Modifier</button>{' '}
                  <button className="btn petit rouge" onClick={() => supprimer(b)}>Supprimer</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.batiments.length === 0 && <div className="vide-note">Aucun bâtiment pour le moment.</div>}

      {edition && (
        <Modal titre={edition.id ? 'Modifier le bâtiment' : 'Nouveau bâtiment'} onFermer={() => setEdition(null)}>
          <div className="champ"><label>Nom (ex: SOLEIL 2)</label>
            <input autoFocus value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} /></div>
          <div className="champ"><label>Adresse (optionnel)</label>
            <input value={edition.adresse || ''} onChange={(e) => setEdition({ ...edition, adresse: e.target.value })} /></div>
          <div className="champ"><label>Note (optionnel)</label>
            <input value={edition.note || ''} onChange={(e) => setEdition({ ...edition, note: e.target.value })} /></div>
          <div className="actions">
            <button className="btn gris" onClick={() => setEdition(null)}>Annuler</button>
            <button className="btn vert" onClick={enregistrer}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
