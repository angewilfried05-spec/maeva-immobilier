import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

// Gestion des photos de la page "Réalisations" du site vitrine.
// Les images partent sur le serveur (dossier vitrine), le site les lit via photos.json.
export default function Realisations() {
  const [photos, setPhotos] = useState([]);
  const [fichier, setFichier] = useState(null);
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = () => api.get('/api/vitrine/photos').then(setPhotos).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  async function envoyer(e) {
    e.preventDefault();
    if (!fichier) { setErreur('Choisissez une photo'); return; }
    setChargement(true); setErreur(''); setInfo('');
    try {
      const fd = new FormData();
      fd.append('photo', fichier);
      fd.append('titre', titre);
      fd.append('texte', texte);
      fd.append('alt', titre || 'Réalisation MAEVA IMMOBILIER');
      await api.upload('/api/vitrine/photos', fd);
      setFichier(null); setTitre(''); setTexte('');
      e.target.reset();
      setInfo('Photo publiée sur le site vitrine.');
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setChargement(false); }
  }

  async function supprimer(p) {
    if (!window.confirm(`Supprimer « ${p.titre || p.src} » du site vitrine ?`)) return;
    try {
      await api.del('/api/vitrine/photos/' + p.src.split('/').pop());
      charger();
    } catch (err) { setErreur(err.message); }
  }

  async function sauverLegende(p) {
    try {
      await api.put('/api/vitrine/photos/' + p.src.split('/').pop(), { titre: p.titre, texte: p.texte });
      setInfo('Légende enregistrée.');
    } catch (err) { setErreur(err.message); }
  }

  return (
    <div>
      <h2>Photos du site vitrine</h2>
      <p className="texte-secondaire">
        Ces photos s'affichent sur la page « Réalisations » du site public (www.maeva-immobilier.com).
      </p>

      <div className="panneau">
        <h3>Ajouter une réalisation</h3>
        <form onSubmit={envoyer} encType="multipart/form-data">
          <div className="champ">
            <label>Photo (jpg, png, webp — 15 Mo max)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFichier(e.target.files[0] || null)} />
          </div>
          <div className="champ">
            <label>Titre du projet</label>
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
        <h3>Photos publiées ({photos.length})</h3>
        {photos.length === 0 && <p className="texte-secondaire">Aucune photo — la page « Réalisations » est masquée sur le site.</p>}
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
    </div>
  );
}
