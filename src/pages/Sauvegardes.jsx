import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api.js';

const TYPES = { auto: 'Automatique', manuel: 'Manuelle', 'avant-restauration': 'Avant restauration' };

function taille(octets) {
  return octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export default function Sauvegardes({ onRestaure }) {
  const [etat, setEtat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const inputRef = useRef(null);

  const reload = () => api.get('/api/sauvegardes').then(setEtat).catch((e) => setMessage({ type: 'erreur', txt: e.message }));
  useEffect(() => { reload(); }, []);

  const sauvegarder = async () => {
    setEnCours(true); setMessage(null);
    try {
      const s = await api.post('/api/sauvegardes');
      setMessage({ type: 'succes', txt: `Sauvegarde créée : ${s.nom}` });
      reload();
    } catch (e) { setMessage({ type: 'erreur', txt: e.message }); }
    setEnCours(false);
  };

  const confirmer = (source) => window.confirm(
    `Restaurer ${source} ?\n\nTOUTES les données actuelles (locataires, paiements, dépenses, devis, utilisateurs…) `
    + 'seront remplacées par celles de la sauvegarde.\nUne sauvegarde de sécurité de l\'état actuel sera créée avant.'
  );

  const terminer = (r) => {
    alert(`Restauration terminée.\nSauvegarde de sécurité : ${r.sauvegarde_securite}\n\nVeuillez vous reconnecter.`);
    onRestaure();
  };

  const restaurer = async (s) => {
    if (!confirmer(`la sauvegarde du ${new Date(s.date).toLocaleString('fr-FR')}`)) return;
    setEnCours(true); setMessage(null);
    try { terminer(await api.post('/api/sauvegardes/restaurer', { nom: s.nom })); }
    catch (e) { setMessage({ type: 'erreur', txt: e.message }); setEnCours(false); }
  };

  const restaurerFichier = async (e) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || !confirmer(`le fichier « ${file.name} »`)) return;
    setEnCours(true); setMessage(null);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      terminer(await api.upload('/api/sauvegardes/restaurer-fichier', fd));
    } catch (err) { setMessage({ type: 'erreur', txt: err.message }); setEnCours(false); }
  };

  if (!etat) return <div>{message ? <div className="message erreur">{message.txt}</div> : <p style={{ padding: 40 }}>Chargement…</p>}</div>;

  return (
    <div>
      <div className="barre">
        <h2 style={{ margin: 0, flex: 1 }}>Sauvegardes</h2>
        <button className="btn gris" onClick={() => window.electron?.ouvrirDossier?.(etat.dossier)}>Ouvrir le dossier</button>
        <input ref={inputRef} type="file" accept=".json" onChange={restaurerFichier} style={{ display: 'none' }} />
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={enCours}>Restaurer depuis un fichier…</button>
        <button className="btn vert" onClick={sauvegarder} disabled={enCours}>{enCours ? 'En cours…' : 'Sauvegarder maintenant'}</button>
      </div>
      {message && <div className={`message ${message.type}`}>{message.txt}</div>}

      <div style={{ marginBottom: 18, padding: 14, background: '#eef3fa', borderRadius: 10, fontSize: 14, color: '#44536a' }}>
        Une sauvegarde automatique est faite chaque jour au démarrage de l'application (les 30 dernières sont conservées).
        Pensez à copier régulièrement le dossier sur une clé USB ou un autre ordinateur.
        <div style={{ marginTop: 6 }}><b>Dossier :</b> {etat.dossier}</div>
      </div>

      {etat.sauvegardes.length === 0 ? (
        <div className="vide-note">Aucune sauvegarde pour le moment.</div>
      ) : (
        <table className="tableau">
          <thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th className="num">Taille</th><th></th></tr></thead>
          <tbody>
            {etat.sauvegardes.map((s) => (
              <tr key={s.nom}>
                <td><b>{new Date(s.date).toLocaleString('fr-FR')}</b></td>
                <td>{TYPES[s.type] || s.type}</td>
                <td style={{ fontSize: 13, color: '#7a8899' }}>{s.nom}</td>
                <td className="num">{taille(s.taille)}</td>
                <td><button className="btn petit rouge" onClick={() => restaurer(s)} disabled={enCours}>Restaurer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
