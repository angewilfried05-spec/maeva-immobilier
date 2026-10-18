import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api.js';

const LIBELLES = {
  CONNECTED: 'Connecté',
  QRCODE: 'QR code à scanner',
  INITIALIZING: 'Initialisation…',
  DISCONNECTED: 'Déconnecté',
  SIMULATION: 'Mode simulation',
  UNAVAILABLE: 'Indisponible',
};

// Page admin : liaison du compte WhatsApp du serveur (QR) et test d'envoi.
export default function WhatsApp() {
  const [statut, setStatut] = useState(null);
  const [message, setMessage] = useState(null);
  const [test, setTest] = useState({ telephone: '', message: '' });
  const [chargement, setChargement] = useState(false);
  const timer = useRef(null);

  const charger = () => api.get('/api/whatsapp/status').then(setStatut).catch((e) => setMessage(e.message));

  useEffect(() => {
    charger();
    // Le QR expire ~30 s et est régénéré : on rafraîchit le statut périodiquement.
    timer.current = setInterval(() => {
      api.get('/api/whatsapp/status').then(setStatut).catch(() => {});
    }, 8000);
    return () => clearInterval(timer.current);
  }, []);

  const action = async (chemin) => {
    setChargement(true); setMessage(null);
    try {
      const s = await api.post(`/api/whatsapp/${chemin}`, {});
      setStatut(s);
    } catch (e) { setMessage(e.message); }
    setChargement(false);
  };

  const lancerRelances = async () => {
    if (!window.confirm('Envoyer maintenant un rappel WhatsApp à tous les locataires en dette ce mois-ci ?')) return;
    setChargement(true); setMessage(null);
    try {
      const r = await api.post('/api/whatsapp/relances', {});
      setMessage(`Relances : ${r.envoyes}/${r.total} envoyée(s).`);
    } catch (e) { setMessage(e.message); }
    setChargement(false);
  };

  const envoyerTest = async () => {
    setChargement(true); setMessage(null);
    try {
      const r = await api.post('/api/whatsapp/test-send', test);
      setMessage(r.simulated ? 'Message journalisé (mode simulation — client non lié).' : 'Message de test envoyé.');
      setTest({ telephone: '', message: '' });
    } catch (e) { setMessage(e.message); }
    setChargement(false);
  };

  if (!statut) return <div><p style={{ padding: 40 }}>Chargement…</p></div>;

  return (
    <div>
      <div className="barre"><h2 style={{ margin: 0, flex: 1 }}>WhatsApp du serveur</h2></div>
      {message && <div className="message erreur">{message}</div>}

      <div className="carte" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className={`badge ${statut.connected ? 'ok' : 'vide'}`}>
            {LIBELLES[statut.status] || statut.status}
          </span>
          {statut.account?.pushname && <span>{statut.account.pushname}</span>}
          {statut.lastError && <span style={{ color: 'var(--rouge)', fontSize: 13 }}>{statut.lastError}</span>}
        </div>

        {statut.qrCodeData && (
          <div style={{ textAlign: 'center', padding: 14 }}>
            <p style={{ marginTop: 0 }}>Ouvrez WhatsApp sur le téléphone à lier → <b>Appareils connectés → Connecter un appareil</b>, puis scannez :</p>
            <img src={statut.qrCodeData} alt="QR WhatsApp" style={{ width: 260, height: 260, border: '1px solid var(--bord)', borderRadius: 8 }} />
            <p style={{ fontSize: 13, color: '#667' }}>Le code se régénère automatiquement toutes les ~30 s.</p>
          </div>
        )}

        {statut.connected && (
          <div className="message succes">Le serveur peut envoyer les relances et les quittances PDF directement par WhatsApp. Les relances automatiques partent les 8 et 15 du mois à 9h.</div>
        )}
        {statut.status === 'DISCONNECTED' && (
          <p>Le client n'est pas lié. Cliquez sur « Afficher le QR » puis scannez-le depuis WhatsApp.</p>
        )}
        {statut.status === 'UNAVAILABLE' && (
          <p>whatsapp-web.js n'est pas installé sur ce serveur. Les envois sont simulés (journalisés) — les liens wa.me des relances restent utilisables.</p>
        )}

        <div className="actions" style={{ marginTop: 8 }}>
          {!statut.connected && (
            <button className="btn vert" disabled={chargement} onClick={() => action('qr')}>Afficher le QR</button>
          )}
          <button className="btn" disabled={chargement} onClick={() => action('relink')}>Re-lier</button>
          {statut.connected && (
            <button className="btn rouge" disabled={chargement} onClick={() => action('logout')}>Déconnecter</button>
          )}
          <button className="btn vert" disabled={chargement || !statut.connected} onClick={lancerRelances}
            title="Envoie un rappel à tous les locataires en dette ce mois-ci">
            Lancer les relances maintenant
          </button>
        </div>
      </div>

      <div className="carte" style={{ maxWidth: 560, marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Message de test</h3>
        <div className="champ"><label>Téléphone (ex : 0708091011 ou +225…)</label>
          <input value={test.telephone} onChange={(e) => setTest({ ...test, telephone: e.target.value })} /></div>
        <div className="champ"><label>Message</label>
          <textarea rows={3} value={test.message} onChange={(e) => setTest({ ...test, message: e.target.value })} /></div>
        <div className="actions">
          <button className="btn vert" disabled={chargement || !test.telephone || !test.message} onClick={envoyerTest}>Envoyer le test</button>
        </div>
      </div>
    </div>
  );
}
