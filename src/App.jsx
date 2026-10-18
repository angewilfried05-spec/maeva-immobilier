import React, { useEffect, useState, useCallback } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import SaisieLoyers from './pages/SaisieLoyers.jsx';
import Locataires from './pages/Locataires.jsx';
import Batiments from './pages/Batiments.jsx';
import Depenses from './pages/Depenses.jsx';
import Historique from './pages/Historique.jsx';
import Recherche from './pages/Recherche.jsx';
import ImportExcel from './pages/ImportExcel.jsx';
import Utilisateurs from './pages/Utilisateurs.jsx';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
import Devis from './pages/Devis.jsx';
import EditeurDevis from './pages/EditeurDevis.jsx';
import CatalogueArticles from './pages/CatalogueArticles.jsx';
import Sauvegardes from './pages/Sauvegardes.jsx';
import Connexion, { sessionSouvenirValide, effacerSouvenir } from './pages/Connexion.jsx';
import { moisCourant } from './utils/format.js';
import { api, getToken, deconnecter as deconnecterApi, AuthError, MODE } from './utils/api.js';
import logo from './assets/logo.png';

const PAGES = [
  ['dashboard', 'Tableau de bord'],
  ['loyers', 'Saisie des loyers'],
  ['locataires', 'Locataires'],
  ['batiments', 'Bâtiments'],
  ['depenses', 'Dépenses'],
  ['historique', 'Historique'],
  ['recherche', 'Recherche'],
  ['import', 'Importer Excel'],
  ['devis', 'Devis BTP'],
  ['catalogue', 'Catalogue prix'],
];

export default function App() {
  const [connecte, setConnecte] = useState(() => Boolean(getToken()) && sessionSouvenirValide());
  const [utilisateur, setUtilisateur] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [showMdp, setShowMdp] = useState(false);
  const [devisId, setDevisId] = useState(null);

  const chargerUtilisateur = useCallback(async () => {
    try { setUtilisateur(await api.me()); }
    catch (e) { if (e instanceof AuthError) deconnecter(); }
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await api.get(`/api/dashboard?mois=${mois}`);
      setData(d);
    } catch (e) {
      if (e instanceof AuthError) deconnecter();
      else console.error('reload:', e.message);
    }
  }, [mois]);

  useEffect(() => {
    if (connecte && getToken()) { chargerUtilisateur(); }
  }, [connecte, chargerUtilisateur]);

  useEffect(() => { if (connecte) reload(); }, [reload, connecte]);

  function deconnecter() {
    deconnecterApi(); // révoque la session serveur + efface les jetons (asynchrone, sans bloquer)
    effacerSouvenir();
    setConnecte(false);
    setPage('dashboard');
    setUtilisateur(null);
    setData(null);
  }

  if (!connecte) return <Connexion onConnecte={() => { setConnecte(true); }} />;
  if (utilisateur?.doit_changer_mdp) {
    return <div className="connexion-fond"><ChangerMotDePasse oblige onFermer={() => { chargerUtilisateur(); reload(); }} /></div>;
  }
  if (!data) return <div className="contenu"><p style={{ padding: 40 }}>Chargement…</p></div>;

  const props = { data, reload, mois, setMois, setPage, utilisateur };
  const estAdmin = utilisateur?.role === 'admin';
  const pagesAffichees = estAdmin ? [...PAGES, ['utilisateurs', 'Utilisateurs'], ['sauvegardes', 'Sauvegardes']] : PAGES;

  return (
    <>
      <nav className="sidebar">
        <div className="logo-boite"><img src={logo} alt="MAEVA IMMOBILIER" /></div>
        <div className="sidebar-scroll">
          {pagesAffichees.map(([id, label]) => (
            <button key={id} className={page === id ? 'actif' : ''} onClick={() => setPage(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="sidebar-bas">
          {utilisateur && (
            <div className="sidebar-profil">
              <span className="nom">{utilisateur.nom_complet}</span>
              <span className="role">{utilisateur.role}</span>
            </div>
          )}
          <button onClick={() => setShowMdp(true)}>Changer le mot de passe</button>
          {MODE === 'local' && <button onClick={() => window.electron?.ouvrirDossier?.()}>Ouvrir le dossier</button>}
          <button onClick={deconnecter}>Se déconnecter</button>
        </div>
      </nav>
      <main className="contenu">
        {page === 'dashboard' && <Dashboard {...props} />}
        {page === 'loyers' && <SaisieLoyers {...props} />}
        {page === 'locataires' && <Locataires {...props} />}
        {page === 'batiments' && <Batiments {...props} />}
        {page === 'depenses' && <Depenses {...props} />}
        {page === 'historique' && <Historique {...props} />}
        {page === 'recherche' && <Recherche {...props} />}
        {page === 'import' && <ImportExcel {...props} />}
        {page === 'devis' && <Devis {...props} devisId={devisId} setDevisId={setDevisId} />}
        {page === 'editeur-devis' && <EditeurDevis {...props} devisId={devisId} setDevisId={setDevisId} />}
        {page === 'catalogue' && <CatalogueArticles {...props} />}
        {page === 'utilisateurs' && estAdmin && <Utilisateurs {...props} />}
        {page === 'sauvegardes' && estAdmin && <Sauvegardes {...props} onRestaure={deconnecter} />}
      </main>
      {showMdp && <ChangerMotDePasse onFermer={() => setShowMdp(false)} />}
    </>
  );
}
