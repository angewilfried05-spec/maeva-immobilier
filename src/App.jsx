import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard.jsx';
import Encaisser from './pages/Encaisser.jsx';
import SaisieLoyers from './pages/SaisieLoyers.jsx';
import Relances from './pages/Relances.jsx';
import Locataires from './pages/Locataires.jsx';
import Batiments from './pages/Batiments.jsx';
import Depenses from './pages/Depenses.jsx';
import Historique from './pages/Historique.jsx';
import Recherche from './pages/Recherche.jsx';
import ImportExcel from './pages/ImportExcel.jsx';
import Utilisateurs from './pages/Utilisateurs.jsx';
import WhatsApp from './pages/WhatsApp.jsx';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
import Devis from './pages/Devis.jsx';
import EditeurDevis from './pages/EditeurDevis.jsx';
import CatalogueArticles from './pages/CatalogueArticles.jsx';
import Telechargements from './pages/Telechargements.jsx';
import Sauvegardes from './pages/Sauvegardes.jsx';
import Connexion, { sessionSouvenirValide, effacerSouvenir } from './pages/Connexion.jsx';
import { moisCourant } from './utils/format.js';
import { api, getToken, deconnecter as deconnecterApi, AuthError, MODE } from './utils/api.js';
import logo from './assets/logo.png';

// id → chemin. Les pages existantes gardent le prop setPage(id) : il est
// traduit en navigation vers le chemin correspondant.
const PAGES = [
  ['tableau-de-bord', 'Tableau de bord'],
  ['encaisser', 'Encaisser'],
  ['loyers', 'Saisie des loyers'],
  ['relances', 'Relances'],
  ['locataires', 'Locataires'],
  ['batiments', 'Bâtiments'],
  ['depenses', 'Dépenses'],
  ['historique', 'Historique'],
  ['recherche', 'Recherche'],
  ['import', 'Importer Excel'],
  ['devis', 'Devis BTP'],
  ['catalogue', 'Catalogue prix'],
  ['telechargements', 'Télécharger les apps'],
];

export default function App() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [connecte, setConnecte] = useState(() => Boolean(getToken()) && sessionSouvenirValide());
  const [utilisateur, setUtilisateur] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [showMdp, setShowMdp] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Données du mois : une seule requête partagée par toutes les pages, en cache.
  const { data, error } = useQuery({
    queryKey: ['dashboard', mois],
    queryFn: () => api.get(`/api/dashboard?mois=${mois}`),
    enabled: connecte && Boolean(utilisateur) && !utilisateur?.doit_changer_mdp,
    retry: (n, e) => !(e instanceof AuthError) && n < 2,
    staleTime: 15000,
  });

  const chargerUtilisateur = useCallback(async () => {
    try { setUtilisateur(await api.me()); }
    catch (e) { if (e instanceof AuthError) deconnecter(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connecte && getToken()) chargerUtilisateur();
  }, [connecte, chargerUtilisateur]);

  useEffect(() => {
    if (error instanceof AuthError) deconnecter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Compatibilité : les pages appellent reload() pour rafraîchir après écriture.
  const reload = useCallback(
    () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
    [qc]
  );
  // Compatibilité : setPage(id) naviguait dans l'état local, désormais vers l'URL.
  const setPage = useCallback((id) => navigate(id.startsWith('/') ? id : `/${id}`), [navigate]);

  function deconnecter() {
    deconnecterApi();
    effacerSouvenir();
    qc.clear();
    setConnecte(false);
    setUtilisateur(null);
    navigate('/tableau-de-bord');
  }

  if (!connecte) return <Connexion onConnecte={() => setConnecte(true)} />;
  if (utilisateur?.doit_changer_mdp) {
    return (
      <div className="connexion-fond">
        <ChangerMotDePasse oblige onFermer={() => { chargerUtilisateur(); reload(); }} />
      </div>
    );
  }
  if (error) return <div className="contenu"><p style={{ padding: 40 }}>Erreur : {error.message} <button className="btn petit" onClick={reload}>Réessayer</button></p></div>;
  if (!utilisateur || !data) return <div className="contenu"><p style={{ padding: 40 }}>Chargement…</p></div>;

  const props = { data, reload, mois, setMois, setPage, utilisateur };
  const estAdmin = utilisateur.role === 'admin';
  const pagesAffichees = estAdmin ? [...PAGES, ['utilisateurs', 'Utilisateurs'], ['whatsapp', 'WhatsApp'], ['sauvegardes', 'Sauvegardes']] : PAGES;

  return (
    <>
      <header className="barre-haut">
        <button className="burger" onClick={() => setMenuOuvert(true)} aria-label="Menu">☰</button>
        <img className="logo-mini" src={logo} alt="MAEVA IMMOBILIER" />
        <span className="titre-mobile">MAEVA IMMOBILIER</span>
      </header>
      {menuOuvert && <button className="sidebar-fond" aria-label="Fermer le menu" onClick={() => setMenuOuvert(false)} />}
      <nav className={`sidebar${menuOuvert ? ' ouverte' : ''}`}>
        <div className="logo-boite"><img src={logo} alt="MAEVA IMMOBILIER" /></div>
        <div className="sidebar-scroll">
          {pagesAffichees.map(([id, label]) => (
            <NavLink key={id} to={`/${id}`} onClick={() => setMenuOuvert(false)}
              className={({ isActive }) => (isActive ? 'actif' : '')}>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-bas">
          <div className="sidebar-profil">
            <span className="nom">{utilisateur.nom_complet}</span>
            <span className="role">{utilisateur.role}</span>
          </div>
          <button onClick={() => setShowMdp(true)}>Changer le mot de passe</button>
          {MODE === 'local' && <button onClick={() => window.electron?.ouvrirDossier?.()}>Ouvrir le dossier</button>}
          <button onClick={deconnecter}>Se déconnecter</button>
        </div>
      </nav>
      <main className="contenu">
        <Routes>
          <Route path="/" element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="/dashboard" element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="/tableau-de-bord" element={<Dashboard {...props} />} />
          <Route path="/encaisser" element={<Encaisser {...props} />} />
          <Route path="/loyers" element={<SaisieLoyers {...props} />} />
          <Route path="/relances" element={<Relances {...props} />} />
          <Route path="/locataires" element={<Locataires {...props} />} />
          <Route path="/batiments" element={<Batiments {...props} />} />
          <Route path="/depenses" element={<Depenses {...props} />} />
          <Route path="/historique" element={<Historique {...props} />} />
          <Route path="/recherche" element={<Recherche {...props} />} />
          <Route path="/import" element={<ImportExcel {...props} />} />
          <Route path="/devis" element={<Devis {...props} />} />
          <Route path="/devis/nouveau" element={<EditeurDevis {...props} devisId={null} />} />
          <Route path="/devis/:devisId" element={<EditeurDevisRoute {...props} />} />
          <Route path="/catalogue" element={<CatalogueArticles {...props} />} />
          <Route path="/telechargements" element={<Telechargements />} />
          {estAdmin && <Route path="/utilisateurs" element={<Utilisateurs {...props} />} />}
          {estAdmin && <Route path="/whatsapp" element={<WhatsApp {...props} />} />}
          {estAdmin && <Route path="/sauvegardes" element={<Sauvegardes {...props} onRestaure={deconnecter} />} />}
          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Routes>
      </main>
      {showMdp && <ChangerMotDePasse onFermer={() => setShowMdp(false)} />}
    </>
  );
}

// Lit l'identifiant du devis dans l'URL (/devis/123)
function EditeurDevisRoute(props) {
  const { devisId } = useParams();
  return <EditeurDevis {...props} devisId={devisId ? Number(devisId) : null} />;
}
