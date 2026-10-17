import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

const CATEGORIES = ['Salaires', 'Charges', 'Travaux', 'Remboursements', 'Autre'];
const VIDE = { designation: '', categorie: 'Charges', quantite: 1, montant_unitaire: '', beneficiaire: '', note: '' };

export default function Depenses({ data, reload, mois, setMois }) {
  const [edition, setEdition] = useState(null);
  const [filtreCat, setFiltreCat] = useState('');
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    api.get('/api/depenses/designations').then(setDesignations).catch(() => {});
  }, [data.depenses]);

  const deps = data.depenses
    .filter((d) => (!filtreCat || d.categorie === filtreCat))
    .sort((a, b) => String(a.categorie).localeCompare(String(b.categorie)));
  const total = deps.reduce((s, d) => s + (Number(d.montant_total) || 0), 0);

  const enregistrer = async () => {
    if (!edition.designation.trim()) return;
    try {
      const body = {
        ...edition, mois,
        designation: edition.designation.trim().toUpperCase(),
        quantite: Number(edition.quantite) || 0,
        montant_unitaire: Number(edition.montant_unitaire) || 0,
      };
      if (edition.id) await api.put(`/api/depenses/${edition.id}`, body);
      else await api.post('/api/depenses', body);
      setEdition(null); reload();
    } catch (e) { alert(e.message); }
  };

  const supprimer = async (d) => {
    if (!window.confirm(`Supprimer la dépense "${d.designation}" ?`)) return;
    try { await api.del(`/api/depenses/${d.id}`); reload(); }
    catch (e) { alert(e.message); }
  };

  const choisirDesignation = (valeur) => {
    if (valeur === '__new__') { setEdition({ ...edition, designation: '', nouvelle: true }); return; }
    const modele = designations.find((d) => d.designation === valeur);
    setEdition({
      ...edition, nouvelle: false, designation: valeur,
      categorie: modele ? modele.categorie : edition.categorie,
      beneficiaire: modele ? (modele.beneficiaire || '') : edition.beneficiaire,
      montant_unitaire: modele ? modele.montant_unitaire : edition.montant_unitaire,
      quantite: modele ? modele.quantite : edition.quantite,
    });
  };

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Dépenses</h2>
        <SelecteurMois mois={mois} onChange={setMois} />
        <select value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn vert" onClick={() => setEdition({ ...VIDE, nouvelle: designations.length === 0 })}>+ Ajouter une dépense</button>
      </div>

      <table className="tableau">
        <thead><tr><th>Désignation</th><th>Catégorie</th><th>Bénéficiaire</th><th className="num">Qté</th><th className="num">Mont. unit.</th><th className="num">Total</th><th></th></tr></thead>
        <tbody>
          {deps.map((d) => (
            <tr key={d.id}>
              <td><b>{d.designation}</b>{d.note ? <div style={{ fontSize: 13, color: '#7a8899' }}>{d.note}</div> : null}</td>
              <td>{d.categorie}</td>
              <td>{d.beneficiaire || '—'}</td>
              <td className="num">{d.quantite}</td>
              <td className="num">{fcfa(d.montant_unitaire)} F</td>
              <td className="num" style={{ fontWeight: 700 }}>{fcfa(d.montant_total)} F</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn petit" onClick={() => setEdition({ ...VIDE, ...d })}>Modifier</button>{' '}
                <button className="btn petit rouge" onClick={() => supprimer(d)}>Suppr.</button>
              </td>
            </tr>
          ))}
          <tr className="groupe">
            <td colSpan={5}><b>TOTAL DÉPENSES</b></td>
            <td className="num" style={{ fontSize: 18 }}><b>{fcfa(total)} F</b></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      {deps.length === 0 && <div className="vide-note">Aucune dépense pour ce mois.</div>}

      {edition && (
        <Modal titre={edition.id ? 'Modifier la dépense' : 'Nouvelle dépense'} onFermer={() => setEdition(null)}>
          <div className="champ"><label>Désignation</label>
            <select autoFocus value={edition.nouvelle ? '__new__' : edition.designation} onChange={(e) => choisirDesignation(e.target.value)}>
              <option value="">— Choisir une dépense —</option>
              {designations.map((d) => <option key={d.designation} value={d.designation}>{d.designation}</option>)}
              <option value="__new__">+ Nouvelle dépense…</option>
            </select></div>
          {edition.nouvelle && (
            <div className="champ"><label>Nouvelle désignation (ex: SALAIRE GARDIEN)</label>
              <input autoFocus value={edition.designation} onChange={(e) => setEdition({ ...edition, designation: e.target.value })} /></div>
          )}
          <div className="champ"><label>Catégorie</label>
            <select value={edition.categorie} onChange={(e) => setEdition({ ...edition, categorie: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="champ"><label>Bénéficiaire (optionnel)</label>
            <input value={edition.beneficiaire || ''} onChange={(e) => setEdition({ ...edition, beneficiaire: e.target.value })} /></div>
          <div className="champ"><label>Quantité</label>
            <input type="number" min="0" value={edition.quantite} onChange={(e) => setEdition({ ...edition, quantite: e.target.value })} /></div>
          <div className="champ"><label>Montant unitaire (FCFA)</label>
            <input type="number" min="0" value={edition.montant_unitaire} onChange={(e) => setEdition({ ...edition, montant_unitaire: e.target.value })} /></div>
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
