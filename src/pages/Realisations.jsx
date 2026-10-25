import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api.js';

// Gestion des images du site vitrine (www.maeva-immobilier.com) :
// onglet "Réalisations" (photos/) et onglet "Location" (locations/).
const COLLECTIONS = [
  { cle: 'photos',     libelle: 'Réalisations', texteIntro: 'Photos de chantiers et projets — page « Réalisations » du site.' },
  { cle: 'locations',  libelle: 'Location',     texteIntro: 'Bâtiments, locaux et portes à louer — page « Location » du site.' },
];

function SectionCollection({ collection }) {
  const [photos, setPhotos] = useState([]);
  const [fichier, setFichier] = useState(null);
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = useCallback(
    () => api.get(`/api/vitrine/${collection.cle}`).then(setPhotos).catch((e) => setErreur(e.message)),
    [collection.cle],
  );
  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e) {
    e.preventDefault();
    if (!fichier) { setErreur('Choisissez une image'); return; }
    setChargement(true); setErreur(''); setInfo('');
    try {
      const fd = new FormData();
      fd.append('photo', fichier);
      fd.append('titre', titre);
      fd.append('texte', texte);
      fd.append('alt', titre || 'MAEVA IMMOBILIER');
      await api.upload(`/api/vitrine/${collection.cle}`, fd);
      setFichier(null); setTitre(''); setTexte('');
      e.target.reset();
      setInfo('Publié sur le site vitrine.');
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setChargement(false); }
  }

  async function supprimer(p) {
    if (!window.confirm(`Supprimer « ${p.titre || p.src} » du site vitrine ?`)) return;
    try {
      await api.del(`/api/vitrine/${collection.cle}/` + p.src.split('/').pop());
      charger();
    } catch (err) { setErreur(err.message); }
  }

  async function sauverLegende(p) {
    try {
      await api.put(`/api/vitrine/${collection.cle}/` + p.src.split('/').pop(), { titre: p.titre, texte: p.texte });
      setInfo('Légende enregistrée.');
    } catch (err) { setErreur(err.message); }
  }

  return (
    <>
      <p className="texte-secondaire">{collection.texteIntro}</p>
      <div className="panneau">
        <h3>Ajouter</h3>
        <form onSubmit={envoyer}>
          <div className="champ">
            <label>Image (jpg, png, webp — 15 Mo max)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFichier(e.target.files[0] || null)} />
          </div>
          <div className="champ">
            <label>Titre</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Clôture d'une cour" />
          </div>
          <div className="champ">
            <label>Description (optionnelle)</label>
            <textarea rows="3" value={texte} onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. Clôture en parpaings avec portail, livrée à Angré." />
          </div>
          {erreur && <p className="form-erreur">{erreur}</p>}
          {info && <p className="form-succes">{info}</p>}
          <button className="btn" type="submit" disabled={chargement}>
            {chargement ? 'Envoi…' : 'Publier sur le site'}
          </button>
        </form>
      </div>

      <div className="panneau">
        <h3>Publiés ({photos.length})</h3>
        {photos.length === 0 && (
          <p className="texte-secondaire">Vide — le lien de cette page est masqué sur le site.</p>
        )}
        {photos.map((p) => {
          const cle = p.src.split('/').pop();
          return (
            <div key={cle} className="photo-ligne">
              <img src={`https://www.maeva-immobilier.com/${p.src}`} alt={p.alt} />
              <div className="photo-meta">
                <input value={p.titre || ''} placeholder="Titre"
                  onChange={(e) => setPhotos(photos.map((x) => x.src === p.src ? { ...x, titre: e.target.value } : x))} />
                <textarea rows="2" value={p.texte || ''} placeholder="Description"
                  onChange={(e) => setPhotos(photos.map((x) => x.src === p.src ? { ...x, texte: e.target.value } : x))} />
                <div>
                  <button className="btn petit" onClick={() => sauverLegende(p)}>Enregistrer</button>{' '}
                  <button className="btn petit danger" onClick={() => supprimer(p)}>Supprimer</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Realisations() {
  const [onglet, setOnglet] = useState('photos');
  const collection = COLLECTIONS.find((c) => c.cle === onglet);
  return (
    <div>
      <h2>Site vitrine</h2>
      <div className="onglets">
        {COLLECTIONS.map((c) => (
          <button key={c.cle}
            className={'onglet' + (onglet === c.cle ? ' actif' : '')}
            onClick={() => setOnglet(c.cle)}>
            {c.libelle}
          </button>
        ))}
      </div>
      <SectionCollection key={collection.cle} collection={collection} />
    </div>
  );
}
