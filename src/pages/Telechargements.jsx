import React, { useEffect, useState } from 'react';
import { API_URL } from '../utils/api.js';

function tailleLisible(octets) {
  if (!octets) return '';
  if (octets > 1048576) return `${(octets / 1048576).toFixed(1)} Mo`;
  return `${Math.round(octets / 1024)} Ko`;
}

const ICO_ANDROID = (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="6" y="8" width="12" height="10" rx="3" />
    <path d="M9 8V5.5M15 8V5.5M8 3.5l1 2M16 3.5l-1 2" />
    <circle cx="10" cy="12" r="0.8" fill="currentColor" />
    <circle cx="14" cy="12" r="0.8" fill="currentColor" />
    <path d="M6 12H3.5M20.5 12H18" />
    <path d="M9.5 18v2.5M14.5 18v2.5" />
  </svg>
);
const ICO_WINDOWS = (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="5" width="18" height="13" rx="2" />
    <path d="M3 15h18M8 21h8" />
  </svg>
);

/** Téléchargement des applications (APK Android + installateur Windows). */
export default function Telechargements() {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/telechargements`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Erreur ${r.status}`))))
      .then(setListe)
      .catch((e) => setErreur(e.message));
  }, []);

  return (
    <div>
      <h2>Télécharger les applications</h2>
      <p style={{ color: 'var(--texte-2)', marginBottom: 20 }}>
        Installez MAEVA IMMOBILIER sur vos autres appareils.
        {erreur && <span className="message erreur" style={{ display: 'block', marginTop: 10 }}>{erreur}</span>}
      </p>

      <div className="cartes">
        <div className="carte">
          <div className="icone">{ICO_ANDROID}</div>
          <div className="corps">
            <div className="libelle">Application Android</div>
            <div className="valeur" style={{ fontSize: 20 }}>APK</div>
            <div className="sous">
              {liste?.android?.disponible
                ? `Prête — ${tailleLisible(liste.android.taille)}`
                : liste ? 'Pas encore publiée' : '…'}
            </div>
          </div>
          {liste?.android?.disponible && (
            <a className="btn vert" href={`${API_URL}${liste.android.url}`} download>
              Télécharger
            </a>
          )}
        </div>

        <div className="carte">
          <div className="icone">{ICO_WINDOWS}</div>
          <div className="corps">
            <div className="libelle">Application Windows</div>
            <div className="valeur" style={{ fontSize: 20 }}>.exe</div>
            <div className="sous">
              {liste?.windows?.disponible
                ? `Prête — ${tailleLisible(liste.windows.taille)}`
                : liste ? 'Pas encore publiée' : '…'}
            </div>
          </div>
          {liste?.windows?.disponible && (
            <a className="btn" href={`${API_URL}${liste.windows.url}`} download>
              Télécharger
            </a>
          )}
        </div>
      </div>

      <div className="panneau">
        <h3>Installer sur Android</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 2, color: 'var(--texte-2)' }}>
          <li>Téléchargez le fichier <b>.apk</b> sur le téléphone</li>
          <li>Ouvrez-le — Android demandera l'autorisation d'installer une app externe</li>
          <li>Au premier lancement, connectez-vous avec vos identifiants</li>
        </ol>
        <h3 style={{ marginTop: 18 }}>Installer sur Windows</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 2, color: 'var(--texte-2)' }}>
          <li>Téléchargez et lancez <b>MAEVA-Immobilier-Setup.exe</b></li>
          <li>Mode connecté : l'app se sert des données du serveur en ligne</li>
        </ol>
      </div>
    </div>
  );
}
