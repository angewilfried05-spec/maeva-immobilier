import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { fcfa, moisLabel } from '../utils/format.js';
import { api } from '../utils/api.js';

const VIDE = { numero_porte: '', nom_locataire: '', loyer_mensuel: '', date_entree: '', statut: 'Actif', telephone: '', note: '', arrieres_initial: 0 };

export default function Locataires({ data, reload }) {
  const [filtreBat, setFiltreBat] = useState('');
  const [edition, setEdition] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [histoData, setHistoData] = useState(null);

  const locs = data.locataires
    .filter((l) => !filtreBat || Number(l.batiment_id) === Number(filtreBat))
    .sort((a, b) => Number(a.batiment_id) - Number(b.batiment_id) || String(a.numero_porte || '').localeCompare(String(b.numero_porte || ''), 'fr', { numeric: true }));

  const nomBat = (id) => data.batiments.find((b) => Number(b.id) === Number(id))?.nom || '';

  const enregistrer = async () => {
    if (!edition.nom_locataire.trim() || !edition.batiment_id) return;
    try {
      const body = {
        ...edition,
        batiment_id: Number(edition.batiment_id),
        loyer_mensuel: Number(edition.loyer_mensuel) || 0,
        arrieres_initial: Number(edition.arrieres_initial) || 0,
      };
      if (edition.id) await api.put(`/api/locataires/${edition.id}`, body);
      else await api.post('/api/locataires', body);
      setEdition(null); reload();
    } catch (e) { alert(e.message); }
  };

  const supprimer = async (l) => {
    if (!window.confirm(`Supprimer le locataire "${l.nom_locataire}" et tout son historique de paiements ?`)) return;
    try { await api.del(`/api/locataires/${l.id}`); reload(); }
    catch (e) { alert(e.message); }
  };

  const voirHistorique = async (l) => {
    try {
      const d = await api.get(`/api/locataires/${l.id}`);
      setHistoData(d); setHistorique(l);
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Locataires</h2>
        <select value={filtreBat} onChange={(e) => setFiltreBat(e.target.value)}>
          <option value="">Tous les bâtiments</option>
          {data.batiments.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </select>
        <button className="btn vert" onClick={() => setEdition({ ...VIDE, batiment_id: filtreBat || data.batiments[0]?.id || '' })}>
          + Ajouter un locataire
        </button>
      </div>

      <table className="tableau">
        <thead><tr><th>Bâtiment</th><th>Porte</th><th>Nom</th><th className="num">Loyer</th><th>Statut</th><th className="num">Retard</th><th>Téléphone</th><th></th></tr></thead>
        <tbody>
          {locs.map((l) => {
            const arr = data.arrieres_courants[l.id] || 0;
            return (
              <tr key={l.id}>
                <td>{nomBat(l.batiment_id)}</td>
                <td>{l.numero_porte || '—'}</td>
                <td><b>{l.nom_locataire}</b>{l.note ? <div style={{ fontSize: 13, color: '#7a8899' }}>{l.note}</div> : null}</td>
                <td className="num">{fcfa(l.loyer_mensuel)} F</td>
                <td>
                  {l.statut === 'Actif' && <span className="badge ok">Actif</span>}
                  {l.statut === 'Vide' && <span className="badge vide">Porte vide</span>}
                  {l.statut === 'Parti' && <span className="badge vide">Parti</span>}
                </td>
                <td className="num">{arr > 0 ? <span className="badge retard">{arr} mois</span> : '—'}</td>
                <td>{l.telephone || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn petit" onClick={() => voirHistorique(l)}>Historique</button>{' '}
                  <button className="btn petit" onClick={() => setEdition({ ...VIDE, ...l })}>Modifier</button>{' '}
                  <button className="btn petit rouge" onClick={() => supprimer(l)}>Suppr.</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {locs.length === 0 && <div className="vide-note">Aucun locataire.</div>}

      {edition && (
        <Modal titre={edition.id ? 'Modifier le locataire' : 'Nouveau locataire'} onFermer={() => setEdition(null)}>
          <div className="champ"><label>Bâtiment</label>
            <select value={edition.batiment_id} onChange={(e) => setEdition({ ...edition, batiment_id: e.target.value })}>
              {data.batiments.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select></div>
          <div className="champ"><label>Numéro de porte (ex: PORTE 1, P3)</label>
            <input value={edition.numero_porte || ''} onChange={(e) => setEdition({ ...edition, numero_porte: e.target.value })} /></div>
          <div className="champ"><label>Nom et prénom</label>
            <input autoFocus value={edition.nom_locataire} onChange={(e) => setEdition({ ...edition, nom_locataire: e.target.value })} /></div>
          <div className="champ"><label>Loyer mensuel (FCFA)</label>
            <input type="number" value={edition.loyer_mensuel} onChange={(e) => setEdition({ ...edition, loyer_mensuel: e.target.value })} /></div>
          <div className="champ"><label>Date d'entrée (optionnel)</label>
            <input type="date" value={edition.date_entree ? String(edition.date_entree).slice(0, 10) : ''} onChange={(e) => setEdition({ ...edition, date_entree: e.target.value })} /></div>
          <div className="champ"><label>Statut</label>
            <select value={edition.statut} onChange={(e) => setEdition({ ...edition, statut: e.target.value })}>
              <option>Actif</option><option>Vide</option><option>Parti</option>
            </select></div>
          <div className="champ"><label>Arriérés au départ (nombre de mois déjà dus)</label>
            <input type="number" min="0" value={edition.arrieres_initial} onChange={(e) => setEdition({ ...edition, arrieres_initial: e.target.value })} /></div>
          <div className="champ"><label>Téléphone (optionnel)</label>
            <input value={edition.telephone || ''} onChange={(e) => setEdition({ ...edition, telephone: e.target.value })} /></div>
          <div className="champ"><label>Note libre</label>
            <input value={edition.note || ''} onChange={(e) => setEdition({ ...edition, note: e.target.value })} /></div>
          <div className="actions">
            <button className="btn gris" onClick={() => setEdition(null)}>Annuler</button>
            <button className="btn vert" onClick={enregistrer}>Enregistrer</button>
          </div>
        </Modal>
      )}

      {historique && histoData && (
        <Modal titre={`Historique — ${historique.nom_locataire}`} onFermer={() => { setHistorique(null); setHistoData(null); }}>
          <HistoriquePaiements data={histoData} />
          <div className="actions"><button className="btn" onClick={() => { setHistorique(null); setHistoData(null); }}>Fermer</button></div>
        </Modal>
      )}
    </div>
  );
}

export function HistoriquePaiements({ data }) {
  const paiements = data.paiements || [];
  if (!paiements.length) return <div className="vide-note">Aucun paiement enregistré.</div>;
  return (
    <table className="tableau">
      <thead><tr><th>Mois</th><th className="num">Qté payée</th><th className="num">Montant</th><th>Date</th><th>Note</th></tr></thead>
      <tbody>
        {paiements.map((p) => (
          <tr key={p.id}>
            <td>{moisLabel(p.mois)}</td>
            <td className="num">{p.quantite_mois_payee}</td>
            <td className="num">{fcfa(p.montant_total_paye)} F</td>
            <td>{p.date_paiement ? String(p.date_paiement).slice(0, 10) : '—'}</td>
            <td>{p.note || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
