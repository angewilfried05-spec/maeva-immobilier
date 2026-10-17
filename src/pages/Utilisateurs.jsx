import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../utils/api.js';

const ROLES = ['admin', 'gerant', 'comptable', 'lecteur'];
const VIDE = { username: '', nom_complet: '', role: 'lecteur', password: '' };

export default function Utilisateurs() {
  const [liste, setListe] = useState(null);
  const [edition, setEdition] = useState(null);
  const [message, setMessage] = useState(null);

  const reload = () => api.get('/api/utilisateurs').then(setListe).catch((e) => setMessage(e.message));
  useEffect(() => { reload(); }, []);

  const enregistrer = async () => {
    if (!edition.username || !edition.nom_complet || !edition.password) {
      setMessage('Tous les champs sont requis'); return;
    }
    try {
      if (edition.id) {
        await api.put(`/api/utilisateurs/${edition.id}`, {
          nom_complet: edition.nom_complet, role: edition.role,
          password: edition.password || undefined, actif: edition.actif !== false,
        });
      } else {
        await api.post('/api/utilisateurs', edition);
      }
      setEdition(null); reload();
    } catch (e) { setMessage(e.message); }
  };

  const supprimer = async (u) => {
    if (!window.confirm(`Supprimer l'utilisateur "${u.username}" ?`)) return;
    try { await api.del(`/api/utilisateurs/${u.id}`); reload(); }
    catch (e) { setMessage(e.message); }
  };

  if (!liste) return <div><p style={{ padding: 40 }}>Chargement…</p></div>;

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Utilisateurs</h2>
        <button className="btn vert" onClick={() => setEdition({ ...VIDE })}>+ Ajouter un utilisateur</button>
      </div>
      {message && <div className="message erreur">{message}</div>}

      <table className="tableau">
        <thead><tr><th>Identifiant</th><th>Nom complet</th><th>Rôle</th><th>Actif</th><th>Dernière connexion</th><th></th></tr></thead>
        <tbody>
          {liste.map((u) => (
            <tr key={u.id}>
              <td><b>{u.username}</b></td>
              <td>{u.nom_complet}</td>
              <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
              <td>{u.actif ? <span className="badge ok">Oui</span> : <span className="badge vide">Non</span>}</td>
              <td>{u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn petit" onClick={() => setEdition({ ...VIDE, ...u, password: '' })}>Modifier</button>{' '}
                <button className="btn petit rouge" onClick={() => supprimer(u)}>Suppr.</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 18, padding: 14, background: '#eef3fa', borderRadius: 10, fontSize: 14, color: '#44536a' }}>
        <b>Rôles :</b> admin (tout) · gerant (saisie + CRUD bâtiments/locataires) · comptable (saisie loyers/dépenses) · lecteur (consultation seule)
      </div>

      {edition && (
        <Modal titre={edition.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'} onFermer={() => { setEdition(null); setMessage(null); }}>
          <div className="champ"><label>Identifiant (login)</label>
            <input autoFocus value={edition.username} disabled={!!edition.id}
              onChange={(e) => setEdition({ ...edition, username: e.target.value })} /></div>
          <div className="champ"><label>Nom complet</label>
            <input value={edition.nom_complet} onChange={(e) => setEdition({ ...edition, nom_complet: e.target.value })} /></div>
          <div className="champ"><label>Rôle</label>
            <select value={edition.role} onChange={(e) => setEdition({ ...edition, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
            </select></div>
          <div className="champ">
            <label>{edition.id ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</label>
            <input type="password" value={edition.password} onChange={(e) => setEdition({ ...edition, password: e.target.value })} />
          </div>
          {edition.id && (
            <div className="champ"><label>Compte actif</label>
              <select value={edition.actif === false ? 'non' : 'oui'} onChange={(e) => setEdition({ ...edition, actif: e.target.value === 'oui' })}>
                <option value="oui">Oui</option><option value="non">Non (désactivé)</option>
              </select></div>
          )}
          <div className="actions">
            <button className="btn gris" onClick={() => { setEdition(null); setMessage(null); }}>Annuler</button>
            <button className="btn vert" onClick={enregistrer}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
