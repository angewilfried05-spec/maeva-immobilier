import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../utils/api.js';

export default function ChangerMotDePasse({ onFermer }) {
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmer, setConfirmer] = useState('');
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    setMessage(null);
    if (nouveau.length < 4) { setMessage({ type: 'erreur', txt: 'Le nouveau mot de passe doit faire au moins 4 caractères.' }); return; }
    if (nouveau !== confirmer) { setMessage({ type: 'erreur', txt: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setEnCours(true);
    try {
      await api.changePassword(ancien, nouveau);
      setMessage({ type: 'succes', txt: 'Mot de passe modifié avec succès.' });
      setAncien(''); setNouveau(''); setConfirmer('');
      setTimeout(onFermer, 1500);
    } catch (e) {
      setMessage({ type: 'erreur', txt: e.message });
    }
    setEnCours(false);
  };

  return (
    <Modal titre="Changer le mot de passe" onFermer={onFermer}>
      {message && <div className={`message ${message.type}`}>{message.txt}</div>}
      <div className="champ"><label>Ancien mot de passe</label>
        <input type="password" autoFocus value={ancien} onChange={(e) => setAncien(e.target.value)} /></div>
      <div className="champ"><label>Nouveau mot de passe</label>
        <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} /></div>
      <div className="champ"><label>Confirmer le nouveau mot de passe</label>
        <input type="password" value={confirmer} onChange={(e) => setConfirmer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') valider(); }} /></div>
      <div className="actions">
        <button className="btn gris" onClick={onFermer}>Annuler</button>
        <button className="btn vert" onClick={valider} disabled={enCours || !ancien || !nouveau || !confirmer}>
          {enCours ? 'Enregistrement…' : 'Changer'}
        </button>
      </div>
    </Modal>
  );
}
