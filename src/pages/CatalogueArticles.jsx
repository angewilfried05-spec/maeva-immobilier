import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

const CATEGORIES = ['Matériaux', "Main d'œuvre"];
const VIDE = { designation: '', categorie: 'Matériaux', unite: 'forfait', prix_unitaire_reference: '' };

export default function CatalogueArticles() {
  const [liste, setListe] = useState(null);
  const [filtreCat, setFiltreCat] = useState('');
  const [edition, setEdition] = useState(null);
  const [message, setMessage] = useState(null);
  const [designationsExistantes, setDesignationsExistantes] = useState([]);
  const [nouvelleDesignation, setNouvelleDesignation] = useState(false);

  const reload = () => {
    const params = filtreCat ? `?categorie=${encodeURIComponent(filtreCat)}` : '';
    api.get('/api/catalogue' + params).then(setListe).catch((e) => setMessage(e.message));
  };

  useEffect(() => {
    reload();
    api.get('/api/catalogue/designations-existantes').then(setDesignationsExistantes).catch(() => {});
  }, [filtreCat]);

  const enregistrer = async () => {
    if (!edition.designation.trim()) return;
    try {
      const body = {
        designation: edition.designation, categorie: edition.categorie,
        unite: edition.unite, prix_unitaire_reference: Number(edition.prix_unitaire_reference) || 0,
      };
      if (edition.id) await api.put(`/api/catalogue/${edition.id}`, body);
      else await api.post('/api/catalogue', body);
      setEdition(null); reload();
      // Rafraîchir la liste des désignations
      api.get('/api/catalogue/designations-existantes').then(setDesignationsExistantes).catch(() => {});
    } catch (e) { setMessage(e.message); }
  };

  const supprimer = async (a) => {
    if (!window.confirm(`Supprimer "${a.designation}" du catalogue ?`)) return;
    try { await api.del(`/api/catalogue/${a.id}`); reload(); }
    catch (e) { setMessage(e.message); }
  };

  const choisirDesignation = (valeur) => {
    if (valeur === '__new__') {
      setNouvelleDesignation(true);
      setEdition({ ...edition, designation: '' });
      return;
    }
    setNouvelleDesignation(false);
    // Cherche si cette désignation existe déjà dans le catalogue pour pré-remplir
    const existant = liste?.find((a) => a.designation === valeur);
    if (existant) {
      setEdition({ ...edition, designation: valeur, categorie: existant.categorie, unite: existant.unite, prix_unitaire_reference: existant.prix_unitaire_reference });
    } else {
      setEdition({ ...edition, designation: valeur });
    }
  };

  if (!liste) return <div><p style={{ padding: 40 }}>Chargement…</p></div>;

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Catalogue de prix</h2>
        <select value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn vert" onClick={() => { setEdition({ ...VIDE }); setNouvelleDesignation(false); }}>+ Ajouter un article</button>
      </div>
      {message && <div className="message erreur">{message}</div>}

      <table className="tableau">
        <thead>
          <tr><th>Désignation</th><th>Catégorie</th><th>Unité</th><th className="num">Prix de référence</th><th>Dernière MAJ</th><th></th></tr>
        </thead>
        <tbody>
          {liste.map((a) => (
            <tr key={a.id}>
              <td><b>{a.designation}</b></td>
              <td>{a.categorie}</td>
              <td>{a.unite}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fcfa(a.prix_unitaire_reference)} F</td>
              <td>{a.date_maj ? String(a.date_maj).slice(0, 10) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn petit" onClick={() => { setEdition({ ...VIDE, ...a, prix_unitaire_reference: a.prix_unitaire_reference }); setNouvelleDesignation(false); }}>Modifier</button>{' '}
                <button className="btn petit rouge" onClick={() => supprimer(a)}>Suppr.</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {liste.length === 0 && <div className="vide-note">Aucun article dans le catalogue.</div>}

      {edition && (
        <Modal titre={edition.id ? 'Modifier l\'article' : 'Nouvel article'} onFermer={() => { setEdition(null); setNouvelleDesignation(false); }}>
          <div className="champ">
            <label>Désignation</label>
            {!edition.id && !nouvelleDesignation ? (
              <>
                <select autoFocus value={edition.designation} onChange={(e) => choisirDesignation(e.target.value)}>
                  <option value="">— Choisir une désignation existante —</option>
                  {designationsExistantes
                    .filter((d) => !liste.some((a) => a.designation === d))
                    .map((d) => <option key={d} value={d}>{d}</option>)}
                  <option value="__new__">+ Nouvelle désignation…</option>
                </select>
                <div style={{ fontSize: 12, color: '#7a8899', marginTop: 4 }}>
                  {designationsExistantes.length} désignation(s) issue(s) des dépenses et devis précédents.
                </div>
              </>
            ) : (
              <>
                <input autoFocus value={edition.designation}
                  onChange={(e) => setEdition({ ...edition, designation: e.target.value })}
                  placeholder="Tapez la désignation…" />
                {!edition.id && (
                  <button className="btn petit gris" style={{ marginTop: 6 }}
                    onClick={() => { setNouvelleDesignation(false); setEdition({ ...edition, designation: '' }); }}>
                    &larr; Choisir dans la liste
                  </button>
                )}
              </>
            )}
          </div>
          <div className="champ"><label>Catégorie</label>
            <select value={edition.categorie} onChange={(e) => setEdition({ ...edition, categorie: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="champ"><label>Unité (sac, botte, voyage, tonne, forfait, m², m³…)</label>
            <input value={edition.unite} onChange={(e) => setEdition({ ...edition, unite: e.target.value })} /></div>
          <div className="champ"><label>Prix unitaire de référence (FCFA)</label>
            <input type="number" min="0" value={edition.prix_unitaire_reference}
              onChange={(e) => setEdition({ ...edition, prix_unitaire_reference: e.target.value })} /></div>
          <div className="actions">
            <button className="btn gris" onClick={() => { setEdition(null); setNouvelleDesignation(false); }}>Annuler</button>
            <button className="btn vert" onClick={enregistrer}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
