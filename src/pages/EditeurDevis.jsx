import React, { useEffect, useState } from 'react';
import { fcfa } from '../utils/format.js';
import { api } from '../utils/api.js';

const TYPES = ['Construction neuve', 'Rénovation', 'Clôture', 'Autre'];
const CATEGORIES = ['Matériaux', "Main d'œuvre"];

function ligneVide(categorie) {
  return { designation: '', categorie, unite: 'U', quantite: 1, prix_unitaire: 0, article_id: null };
}

export default function EditeurDevis({ devisId, setPage, data }) {
  const [devis, setDevis] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [message, setMessage] = useState(null);
  const [rechercheCat, setRechercheCat] = useState({}); // { ligneIdx: terme }

  useEffect(() => {
    api.get('/api/catalogue').then(setCatalogue).catch(() => {});
    if (devisId) {
      api.get(`/api/devis/${devisId}`).then((d) => {
        setDevis({
          ...d,
          lignes: d.lignes.length ? d.lignes : [ligneVide('Matériaux')],
        });
      }).catch((e) => setMessage(e.message));
    } else {
      setDevis({
        titre_objet: '', client_nom: '', client_contact: '', type: 'Construction neuve',
        taux_tva: 0, lieu: 'Abidjan', date: new Date().toISOString().slice(0, 10),
        batiment_id: null, note: '', statut: 'Brouillon',
        lignes: [ligneVide('Matériaux')],
      });
    }
  }, [devisId]);

  if (!devis) return <div><p style={{ padding: 40 }}>Chargement…</p></div>;

  const maj = (champ, val) => setDevis({ ...devis, [champ]: val });

  const majLigne = (i, champ, val) => {
    const lignes = [...devis.lignes];
    lignes[i] = { ...lignes[i], [champ]: val };
    if (champ === 'quantite' || champ === 'prix_unitaire') {
      lignes[i].prix_total = Math.round((Number(lignes[i].quantite) || 0) * (Number(lignes[i].prix_unitaire) || 0));
    }
    setDevis({ ...devis, lignes });
  };

  const ajouterLigne = (categorie) => {
    setDevis({ ...devis, lignes: [...devis.lignes, ligneVide(categorie)] });
  };

  const supprimerLigne = (i) => {
    const lignes = devis.lignes.filter((_, idx) => idx !== i);
    setDevis({ ...devis, lignes: lignes.length ? lignes : [ligneVide('Matériaux')] });
  };

  const choisirArticle = (i, articleId) => {
    if (!articleId) { majLigne(i, 'article_id', null); return; }
    const art = catalogue.find((a) => Number(a.id) === Number(articleId));
    if (!art) return;
    const lignes = [...devis.lignes];
    lignes[i] = {
      ...lignes[i],
      article_id: art.id,
      designation: art.designation,
      categorie: art.categorie,
      unite: art.unite || 'U',
      prix_unitaire: art.prix_unitaire_reference,
      prix_total: Math.round((Number(lignes[i].quantite) || 1) * art.prix_unitaire_reference),
    };
    setDevis({ ...devis, lignes });
  };

  // Totaux temps réel
  const totaux = devis.lignes.reduce((acc, l) => {
    const total = Number(l.prix_total) || 0;
    if (l.categorie === "Main d'œuvre") acc.mo += total;
    else acc.materiel += total;
    return acc;
  }, { materiel: 0, mo: 0 });
  const totalHt = totaux.materiel + totaux.mo;
  const totalTva = Math.round(totalHt * (Number(devis.taux_tva) || 0) / 100);
  const totalGeneral = totalHt + totalTva;

  const enregistrer = async () => {
    if (!devis.titre_objet.trim()) { setMessage('Objet du devis requis'); return; }
    if (!devis.client_nom.trim()) { setMessage('Nom du client requis'); return; }
    setSauvegarde(true);
    try {
      const body = {
        titre_objet: devis.titre_objet, client_nom: devis.client_nom,
        client_contact: devis.client_contact, type: devis.type, taux_tva: devis.taux_tva,
        lieu: devis.lieu, date: devis.date, batiment_id: devis.batiment_id || null,
        note: devis.note, statut: devis.statut,
        lignes: devis.lignes.filter((l) => l.designation.trim()),
      };
      if (devisId) await api.put(`/api/devis/${devisId}`, body);
      else { const r = await api.post('/api/devis', body); setPage(`/devis/${r.id}`); }
      setMessage('Devis enregistré');
      setTimeout(() => setPage('devis'), 800);
    } catch (e) { setMessage(e.message); }
    setSauvegarde(false);
  };

  const exporter = async (format) => {
    if (devisId) {
      try {
        const nom = await api.telecharger('POST', `/api/devis/${devisId}/export`, { format });
        setMessage(`${format.toUpperCase()} téléchargé : ${nom}`);
      } catch (e) { setMessage(e.message); }
    } else {
      setMessage('Enregistrez le devis avant d\'exporter');
    }
  };

  return (
    <div>
      <div className="barre">
        <button className="btn gris" onClick={() => setPage('devis')}>&larr; Retour</button>
        <h2 style={{ margin: '0 0 0 12px', flex: 1 }}>{devisId ? `Devis ${devis.numero || ''}` : 'Nouveau devis'}</h2>
        {devisId && (
          <>
            <button className="btn" onClick={() => exporter('docx')}>Exporter Word</button>
            <button className="btn" onClick={() => exporter('pdf')}>Exporter PDF</button>
          </>
        )}
        <button className="btn vert" onClick={enregistrer} disabled={sauvegarde}>
          {sauvegarde ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {message && <div className={`message ${message.includes('requi') || message.includes('Erreur') ? 'erreur' : 'succes'}`}>{message}</div>}

      {/* En-tête du devis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="champ"><label>Objet du devis *</label>
          <input value={devis.titre_objet} onChange={(e) => maj('titre_objet', e.target.value)}
            placeholder="ex: DEVIS DE CLÔTURE CGK" /></div>
        <div className="champ"><label>Type</label>
          <select value={devis.type} onChange={(e) => maj('type', e.target.value)}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div className="champ"><label>Nom du client *</label>
          <input value={devis.client_nom} onChange={(e) => maj('client_nom', e.target.value)}
            placeholder="ex: M. KOUAME Jean" /></div>
        <div className="champ"><label>Contact client (optionnel)</label>
          <input value={devis.client_contact || ''} onChange={(e) => maj('client_contact', e.target.value)}
            placeholder="Téléphone, adresse…" /></div>
        <div className="champ"><label>Lieu</label>
          <input value={devis.lieu} onChange={(e) => maj('lieu', e.target.value)} /></div>
        <div className="champ"><label>Date</label>
          <input type="date" value={devis.date ? String(devis.date).slice(0, 10) : ''} onChange={(e) => maj('date', e.target.value)} /></div>
        <div className="champ"><label>TVA (%)</label>
          <input type="number" min="0" max="100" step="0.5" value={devis.taux_tva}
            onChange={(e) => maj('taux_tva', e.target.value)} /></div>
        <div className="champ"><label>Statut</label>
          <select value={devis.statut} onChange={(e) => maj('statut', e.target.value)}>
            {['Brouillon','Envoyé','Accepté','Refusé','Facturé'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
        {data?.batiments?.length > 0 && (
          <div className="champ"><label>Bâtiment rattaché (optionnel)</label>
            <select value={devis.batiment_id || ''} onChange={(e) => maj('batiment_id', e.target.value || null)}>
              <option value="">— Aucun —</option>
              {data.batiments.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select></div>
        )}
      </div>

      {/* Lignes du devis */}
      <h3>Lignes du devis</h3>
      <table className="tableau">
        <thead>
          <tr>
            <th style={{ width: 40 }}>Cat.</th>
            <th>Désignation</th>
            <th style={{ width: 70 }}>Unité</th>
            <th className="num" style={{ width: 80 }}>Qté</th>
            <th className="num" style={{ width: 120 }}>Prix unit.</th>
            <th className="num" style={{ width: 120 }}>Prix total</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {devis.lignes.map((l, i) => (
            <React.Fragment key={i}>
              <tr>
                <td>
                  <select value={l.categorie} onChange={(e) => majLigne(i, 'categorie', e.target.value)} style={{ fontSize: 12 }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'Matériaux' ? 'M' : 'MO'}</option>)}
                  </select>
                </td>
                <td>
                  <input value={l.designation} onChange={(e) => majLigne(i, 'designation', e.target.value)}
                    placeholder="Désignation ou choisir dans le catalogue ↓" style={{ width: '100%' }} />
                </td>
                <td>
                  <input value={l.unite || 'U'} onChange={(e) => majLigne(i, 'unite', e.target.value)}
                    placeholder="U" style={{ width: '100%', fontSize: 13 }} />
                </td>
                <td className="num">
                  <input className="qte" type="number" min="0" step="0.5" value={l.quantite}
                    onChange={(e) => majLigne(i, 'quantite', Number(e.target.value) || 0)} />
                </td>
                <td className="num">
                  <input className="montant" type="number" min="0" value={l.prix_unitaire}
                    onChange={(e) => majLigne(i, 'prix_unitaire', Number(e.target.value) || 0)} />
                </td>
                <td className="num" style={{ fontWeight: 700 }}>{fcfa(l.prix_total)} F</td>
                <td>
                  <button className="btn petit rouge" onClick={() => supprimerLigne(i)}>✕</button>
                </td>
              </tr>
              <tr>
                <td colSpan={6} style={{ padding: '4px 12px', background: '#f8f9fb' }}>
                  <select value="" onChange={(e) => choisirArticle(i, e.target.value)} style={{ fontSize: 12, width: '100%' }}>
                    <option value="">— Choisir dans le catalogue —</option>
                    {catalogue
                      .filter((a) => a.categorie === l.categorie)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.designation} — {a.unite} — {fcfa(a.prix_unitaire_reference)} F
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <button className="btn" onClick={() => ajouterLigne('Matériaux')}>+ Ligne Matériaux</button>
        <button className="btn" onClick={() => ajouterLigne("Main d'œuvre")}>+ Ligne Main d'œuvre</button>
      </div>

      {/* Totaux */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <table className="tableau" style={{ width: 360 }}>
          <tbody>
            <tr><td>Total Matériel</td><td className="num">{fcfa(totaux.materiel)} F</td></tr>
            <tr><td>Main d'œuvre</td><td className="num">{fcfa(totaux.mo)} F</td></tr>
            <tr><td>Total HT</td><td className="num">{fcfa(totalHt)} F</td></tr>
            {Number(devis.taux_tva) > 0 && (
              <tr><td>TVA ({devis.taux_tva}%)</td><td className="num">{fcfa(totalTva)} F</td></tr>
            )}
            <tr className="groupe">
              <td style={{ fontWeight: 700, fontSize: 16 }}>TOTAL GÉNÉRAL</td>
              <td className="num" style={{ fontWeight: 700, fontSize: 16, color: 'var(--bleu)' }}>{fcfa(totalGeneral)} F</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="champ" style={{ marginTop: 16 }}>
        <label>Note (optionnel)</label>
        <input value={devis.note || ''} onChange={(e) => maj('note', e.target.value)} />
      </div>
    </div>
  );
}
