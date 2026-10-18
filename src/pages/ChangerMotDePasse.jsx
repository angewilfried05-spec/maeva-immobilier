import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api, setToken } from '../utils/api.js';

// oblige : premier accès avec un mot de passe par défaut / fixé par l'admin (pas d'annulation possible)
export default function ChangerMotDePasse({ onFermer, oblige = false }) {
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmer, setConfirmer] = useState('');
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    setMessage(null);
    if (nouveau.length < 8) { setMessage({ type: 'erreur', txt: 'Le nouveau mot de passe doit faire au moins 8 caractères.' }); return; }
    if (nouveau !== confirmer) { setMessage({ type: 'erreur', txt: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setEnCours(true);
    try {
      const r = await api.changePassword(ancien, nouveau);
      if (r?.token) setToken(r.token);
      setMessage({ type: 'succes', txt: 'Mot de passe modifié avec succès.' });
      setAncien(''); setNouveau(''); setConfirmer('');
      setTimeout(onFermer, oblige ? 600 : 1500);
    } catch (e) {
      setMessage({ type: 'erreur', txt: e.message });
    }
    setEnCours(false);
  };

  return (
    <Modal titre={oblige ? 'Choisissez votre mot de passe' : 'Changer le mot de passe'} onFermer={oblige ? () => {} : onFermer}>
      {oblige && (
        <div className="message erreur" style={{ fontWeight: 500 }}>
          Votre compte utilise un mot de passe provisoire. Pour la sécurité de vos données,
          choisissez un mot de passe personnel (8 caractères minimum) avant de continuer.
        </div>
      )}
      {message && <div className={`message ${message.type}`}>{message.txt}</div>}
      <div className="champ"><label>{oblige ? 'Mot de passe actuel (provisoire)' : 'Ancien mot de passe'}</label>
        <input type="password" autoFocus value={ancien} onChange={(e) => setAncien(e.target.value)} /></div>
      <div className="champ"><label>Nouveau mot de passe</label>
        <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} /></div>
      <div className="champ"><label>Confirmer le nouveau mot de passe</label>
        <input type="password" value={confirmer} onChange={(e) => setConfirmer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') valider(); }} /></div>
      <div className="actions">
        {!oblige && <button className="btn gris" onClick={onFermer}>Annuler</button>}
        <button className="btn vert" onClick={valider} disabled={enCours || !ancien || !nouveau || !confirmer}>
          {enCours ? 'Enregistrement…' : 'Changer'}
        </button>
      </div>
    </Modal>
  );
}
