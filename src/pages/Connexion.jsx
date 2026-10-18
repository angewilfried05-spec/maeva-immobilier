import React, { useState } from 'react';
import logo from '../assets/logo.png';
import embleme from '../assets/logo-embleme.png';
import { api, setSession } from '../utils/api.js';

const CLE_SOUVENIR = 'maeva_souvenir';
const DUREE_JOURS = 30;

export function sessionSouvenirValide() {
  try {
    const raw = localStorage.getItem(CLE_SOUVENIR);
    if (!raw) return false;
    const { exp } = JSON.parse(raw);
    return Date.now() < exp;
  } catch { return false; }
}

export function effacerSouvenir() {
  localStorage.removeItem(CLE_SOUVENIR);
}

export default function Connexion({ onConnecte }) {
  const [utilisateur, setUtilisateur] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [souvenir, setSouvenir] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const res = await api.login(utilisateur, motDePasse);
      setSession(res);
      if (souvenir) {
        localStorage.setItem(CLE_SOUVENIR, JSON.stringify({ exp: Date.now() + DUREE_JOURS * 86400000 }));
      } else {
        effacerSouvenir();
      }
      onConnecte();
    } catch (err) {
      setErreur(err.message || "Nom d'utilisateur ou mot de passe incorrect.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="connexion-fond">
      <div className="connexion-wrapper">
        <aside className="connexion-bienvenue">
          <img src={embleme} alt="" className="bienvenue-embleme" />
          <h1>Bienvenue</h1>
          <p className="bienvenue-texte">
            Votre gestion immobilière, simplifiée. Encaissements, quittances,
            relances et suivi de vos bâtiments — au même endroit.
          </p>
          <ul className="bienvenue-points">
            <li>
              <span className="point-icone">◈</span>
              Suivi des loyers, cautions et arriérés en temps réel
            </li>
            <li>
              <span className="point-icone">◈</span>
              Quittances PDF envoyées automatiquement par WhatsApp
            </li>
            <li>
              <span className="point-icone">◈</span>
              Relances programmées et paiements hors-ligne sur mobile
            </li>
          </ul>
          <div className="bienvenue-plateformes">
            Disponible sur Web · Windows · Android
          </div>
        </aside>

        <form className="connexion-carte" onSubmit={valider}>
          <img src={logo} alt="MAEVA IMMOBILIER" className="connexion-logo" />
          {erreur && <div className="message erreur">{erreur}</div>}
          <div className="champ">
            <label>Nom d'utilisateur</label>
            <input autoFocus value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} />
          </div>
          <div className="champ">
            <label>Mot de passe</label>
            <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          </div>
          <label className="souvenir-ligne">
            <input type="checkbox" checked={souvenir} onChange={(e) => setSouvenir(e.target.checked)} />
            Se souvenir de moi sur cet ordinateur
          </label>
          <button className="btn connexion-btn" type="submit" disabled={enCours}>
            {enCours ? 'Vérification…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
