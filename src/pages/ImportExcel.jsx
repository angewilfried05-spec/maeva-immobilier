import React, { useEffect, useRef, useState } from 'react';
import { fcfa, moisLabel } from '../utils/format.js';
import { api, API_URL } from '../utils/api.js';

export default function ImportExcel({ reload, setPage, data }) {
  const [apercu, setApercu] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [autoImport, setAutoImport] = useState(false);
  const inputRef = useRef(null);

  // Au premier lancement (aucun bâtiment), proposer l'import du fichier embarqué
  useEffect(() => {
    if (data && data.batiments.length === 0 && !apercu && !enCours) {
      setAutoImport(true);
    }
  }, [data, apercu, enCours]);

  const importerFichierEmbarque = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      // Le fichier Excel est embarqué dans assets/ et servi par le backend
      const res = await fetch(`${API_URL}/api/import/fichier-embarque`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('maeva_jwt') },
      });
      if (!res.ok) throw new Error('Fichier exemple introuvable');
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('fichier', blob, 'LOYER_AOUT_2026_EXEMPLE.xlsx');
      const p = await api.upload('/api/import/preview', fd);
      setApercu(p);
    } catch (err) {
      setErreur('Impossible de charger le fichier exemple : ' + err.message);
    }
    setEnCours(false);
    setAutoImport(false);
  };

  const choisir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErreur(null);
    setEnCours(true);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      const p = await api.upload('/api/import/preview', fd);
      setApercu(p);
    } catch (err) {
      setErreur('Impossible de lire ce fichier : ' + err.message);
    }
    setEnCours(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const modifierLocataire = (bi, li, champ, valeur) => {
    const copie = structuredClone(apercu);
    copie.batiments[bi].locataires[li][champ] = valeur;
    setApercu(copie);
  };

  const valider = async () => {
    setEnCours(true);
    try {
      await api.post('/api/import/commit', apercu);
      await reload();
      setApercu(null);
      alert('Import terminé. Vous pouvez maintenant utiliser le tableau de bord.');
      setPage('dashboard');
    } catch (e) { setErreur("Erreur pendant l'import : " + e.message); }
    setEnCours(false);
  };

  return (
    <div>
      <h2>Importer un fichier Excel existant</h2>
      <p style={{ marginBottom: 16, color: '#5b6b7c' }}>
        Choisissez un fichier mensuel (ex: <i>LOYER 8iem DU MOIS DE AOUT 2026 ANGRE.xlsx</i>).
        L'application lit les bâtiments, locataires, loyers et dépenses, puis vous montre un aperçu
        à vérifier avant l'enregistrement.
      </p>
      {erreur && <div className="message erreur">{erreur}</div>}

      {autoImport && (
        <div className="message succes" style={{ fontSize: 16, padding: '20px 24px' }}>
          <b>Bienvenue !</b> Votre base est vide. Voulez-vous importer votre fichier Excel
          d'août 2026 pour démarrer ? &nbsp;
          <button className="btn vert petit" onClick={importerFichierEmbarque} disabled={enCours} style={{ marginLeft: 10 }}>
            {enCours ? 'Chargement…' : 'Oui, importer'}
          </button>
          <button className="btn gris petit" onClick={() => setAutoImport(false)} style={{ marginLeft: 6 }}>
            Plus tard
          </button>
        </div>
      )}

      <div className="barre">
        <input ref={inputRef} type="file" accept=".xlsx" onChange={choisir} style={{ display: 'none' }} />
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={enCours}>Choisir le fichier Excel…</button>
        {enCours && <span>Lecture en cours…</span>}
      </div>

      {apercu && (
        <>
          <div className="cartes">
            <div className="carte"><div className="libelle">Mois détecté</div><div className="valeur">{moisLabel(apercu.mois)}</div></div>
            <div className="carte"><div className="libelle">Bâtiments</div><div className="valeur">{apercu.batiments.length}</div></div>
            <div className="carte"><div className="libelle">Locataires</div><div className="valeur">{apercu.batiments.reduce((s, b) => s + b.locataires.length, 0)}</div></div>
            <div className="carte"><div className="libelle">Dépenses</div><div className="valeur">{apercu.depenses.length}</div></div>
          </div>

          <div className="barre">
            <label style={{ fontWeight: 700 }}>Mois :</label>
            <input type="month" value={apercu.mois} onChange={(e) => setApercu({ ...apercu, mois: e.target.value })} />
            <div style={{ flex: 1 }} />
            <button className="btn vert" onClick={valider} disabled={enCours}>Valider l'import</button>
          </div>

          <h2>Locataires détectés (modifiables)</h2>
          <table className="tableau">
            <thead><tr><th>Porte</th><th>Nom</th><th className="num">Loyer</th><th className="num">Qté payée ce mois</th><th>Statut</th><th className="num">Arriérés (mois)</th><th>Note détectée</th></tr></thead>
            <tbody>
              {apercu.batiments.map((b, bi) => (
                <React.Fragment key={bi}>
                  <tr className="groupe"><td colSpan={7}>{b.nom}</td></tr>
                  {b.locataires.map((l, li) => (
                    <tr key={li}>
                      <td><input style={{ width: 90 }} value={l.numero_porte || ''} onChange={(e) => modifierLocataire(bi, li, 'numero_porte', e.target.value)} /></td>
                      <td><input style={{ width: '100%' }} value={l.nom_locataire} onChange={(e) => modifierLocataire(bi, li, 'nom_locataire', e.target.value)} /></td>
                      <td className="num"><input className="montant" type="number" value={l.loyer_mensuel} onChange={(e) => modifierLocataire(bi, li, 'loyer_mensuel', Number(e.target.value) || 0)} /></td>
                      <td className="num"><input className="qte" type="number" value={l.qte_payee_ce_mois} onChange={(e) => modifierLocataire(bi, li, 'qte_payee_ce_mois', Number(e.target.value) || 0)} /></td>
                      <td>
                        <select value={l.statut} onChange={(e) => modifierLocataire(bi, li, 'statut', e.target.value)}>
                          <option>Actif</option><option>Vide</option><option>Parti</option>
                        </select>
                      </td>
                      <td className="num"><input className="qte" type="number" value={l.arrieres_initial} onChange={(e) => modifierLocataire(bi, li, 'arrieres_initial', Number(e.target.value) || 0)} /></td>
                      <td style={{ fontSize: 13, color: '#7a8899' }}>{l.note || ''}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 26 }}>Dépenses détectées</h2>
          <table className="tableau">
            <thead><tr><th>Désignation</th><th>Catégorie proposée</th><th className="num">Qté</th><th className="num">Mont. unit.</th><th className="num">Total</th></tr></thead>
            <tbody>
              {apercu.depenses.map((d, i) => (
                <tr key={i}>
                  <td>{d.designation}</td>
                  <td>
                    <select value={d.categorie} onChange={(e) => {
                      const copie = structuredClone(apercu);
                      copie.depenses[i].categorie = e.target.value;
                      setApercu(copie);
                    }}>
                      <option>Salaires</option><option>Charges</option><option>Travaux</option>
                      <option>Remboursements</option><option>Autre</option>
                    </select>
                  </td>
                  <td className="num">{d.quantite}</td>
                  <td className="num">{fcfa(d.montant_unitaire)} F</td>
                  <td className="num">{fcfa(d.montant_total)} F</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="barre" style={{ marginTop: 20 }}>
            <div style={{ flex: 1 }} />
            <button className="btn vert" onClick={valider} disabled={enCours}>
              {enCours ? 'Import en cours…' : "Valider l'import"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
