import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { api, setToken } from '../utils/api.js';

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
      setToken(res.token);
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
  );
}
