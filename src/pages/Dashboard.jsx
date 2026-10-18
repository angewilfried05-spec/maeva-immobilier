import React, { useMemo, useState } from 'react';
import SelecteurMois from '../components/SelecteurMois.jsx';
import { fcfa, fmtNombre, moisLabel } from '../utils/format.js';
import { api } from '../utils/api.js';

// Petites icônes SVG inline (identité visuelle APK : pastille + glyphe)
const ICO = {
  percus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>,
  attendus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16v16l-3-2-2.5 2-2.5-2L9 20l-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>,
  depenses: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M17 7c0-2-2.2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3"/></svg>,
  portes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M3 21h18"/><circle cx="13.5" cy="12" r="1"/></svg>,
  cautions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>,
  dette: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3L2 21h20z"/><path d="M12 10v5M12 18h.01"/></svg>,
};

function Tuile({ icone, libelle, valeur, classe, sous }) {
  return (
    <div className={`carte ${classe || ''}`}>
      <div className="icone">{icone}</div>
      <div className="corps">
        <div className="libelle">{libelle}</div>
        <div className="valeur">{valeur}</div>
        {sous && <div className="sous">{sous}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ data, reload, mois, setMois, setPage, utilisateur }) {
  const [remisEdit, setRemisEdit] = useState(null);
  const [message, setMessage] = useState(null);

  const stats = useMemo(() => {
    const attendu = data.par_batiment.reduce((s, b) => s + b.attendu, 0);
    const percu = data.par_batiment.reduce((s, b) => s + b.percu, 0);
    const depenses = data.depenses.reduce((s, d) => s + (Number(d.montant_total) || 0), 0);
    return { attendu, percu, depenses, solde: percu - depenses };
  }, [data]);

  const remis = data.resume ? Number(data.resume.montant_remis_au_proprietaire) || 0 : 0;
  const detteTotale = Object.values(data.situations).reduce((s, x) => s + x.dette, 0);

  const exporterExcel = async () => {
    try {
      const nom = await api.telecharger('POST', '/api/export/rapport', { mois });
      setMessage({ type: 'succes', txt: `Rapport Excel téléchargé : ${nom}` });
    } catch (e) { setMessage({ type: 'erreur', txt: e.message }); }
  };

  const validerRemis = async () => {
    try {
      await api.put(`/api/resumes/${mois}/remis`, { montant: Number(remisEdit) || 0 });
      setRemisEdit(null); reload();
    } catch (e) { setMessage({ type: 'erreur', txt: e.message }); }
  };

  const prenom = (utilisateur?.nom_complet || '').split(' ')[0] || '';

  return (
    <div>
      <div className="hero">
        <div className="hero-haut">
          <div>
            <div className="bonjour">Bonjour,</div>
            <div className="nom">{utilisateur?.nom_complet || '…'}</div>
          </div>
          <div className="hero-actions">
            <SelecteurMois mois={mois} onChange={setMois} />
            <button className="btn ghost" onClick={exporterExcel}>Exporter Excel</button>
          </div>
        </div>
        <div>
          <div className="hero-mois">Solde — {moisLabel(mois)}</div>
          <div className="hero-solde">{fcfa(stats.solde)} F</div>
        </div>
        <div className="hero-actions">
          <span className="puce blanche">Perçu {fcfa(stats.percu)} F</span>
          <span className="puce or">Attendu {fcfa(stats.attendu)} F</span>
          {data.alertes?.mois_cloture && <span className="puce blanche">Mois clôturé — écritures figées</span>}
          {(data.alertes?.portes_libres > 0) &&
            <span className="puce blanche">{data.alertes.portes_libres} porte(s) libre(s)</span>}
        </div>
        {message && <div className={`message ${message.type}`} style={{ marginBottom: 0 }}>{message.txt}</div>}
      </div>

      <div className="cartes">
        <Tuile icone={ICO.percus} classe="vert" libelle="Loyers perçus" valeur={`${fcfa(stats.percu)} F`} />
        <Tuile icone={ICO.attendus} classe="bleu" libelle="Loyers attendus" valeur={`${fcfa(stats.attendu)} F`} />
        <Tuile icone={ICO.depenses} libelle="Dépenses" valeur={`${fcfa(stats.depenses)} F`} />
        <Tuile icone={ICO.portes} classe="orange" libelle="Portes libres" valeur={data.alertes?.portes_libres ?? 0}
               sous={data.alertes?.portes_libres > 0 ? 'Cliquer pour voir' : undefined} />
        <Tuile icone={ICO.cautions} classe="bleu" libelle="Cautions détenues" valeur={`${fcfa(data.cautions_detenues)} F`} />
        <Tuile icone={ICO.dette} classe="rouge" libelle="Dette des locataires" valeur={`${fcfa(detteTotale)} F`} />
        <div className="carte">
          <div className="icone">{ICO.cautions}</div>
          <div className="corps">
            <div className="libelle">Remis au Boss — {moisLabel(mois)}</div>
            {remisEdit === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="valeur">{fcfa(remis)} F</div>
                <button className="btn petit" onClick={() => setRemisEdit(String(remis))}>Modifier</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="montant" autoFocus value={remisEdit}
                  onChange={(e) => setRemisEdit(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') validerRemis(); }} />
                <button className="btn petit vert" onClick={validerRemis}>OK</button>
                <button className="btn petit gris" onClick={() => setRemisEdit(null)}>Annuler</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.en_retard.length > 0 && (
        <div className="message erreur">
          <b>{data.en_retard.length}</b> locataire(s) en retard —{' '}
          <a style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => setPage('relances')}><u>Relancer</u></a>
        </div>
      )}

      <h2>Par bâtiment</h2>
      <table className="tableau">
        <thead>
          <tr><th>Bâtiment</th><th className="num">Locataires actifs</th><th className="num">Attendu</th><th className="num">Perçu</th><th className="num">Reste</th></tr>
        </thead>
        <tbody>
          {data.par_batiment.map((b) => (
            <tr key={b.id}>
              <td><b>{b.nom}</b></td>
              <td className="num">{b.nb}</td>
              <td className="num">{fcfa(b.attendu)} F</td>
              <td className="num" style={{ color: 'var(--vert)', fontWeight: 700 }}>{fcfa(b.percu)} F</td>
              <td className="num" style={{ color: b.attendu - b.percu > 0 ? 'var(--rouge)' : 'inherit' }}>{fcfa(b.attendu - b.percu)} F</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 26 }}>
        Locataires en retard{' '}
        {data.en_retard.length > 0 && <span className="badge retard">{data.en_retard.length}</span>}
      </h2>
      {data.en_retard.length === 0 ? (
        <div className="vide-note">Aucun locataire en retard.</div>
      ) : (
        <table className="tableau">
          <thead><tr><th>Locataire</th><th>Bâtiment / Porte</th><th className="num">Loyer</th><th className="num">Équivalent</th><th className="num">Montant dû</th></tr></thead>
          <tbody>
            {data.en_retard.map((l) => {
              const bat = data.batiments.find((b) => Number(b.id) === Number(l.batiment_id));
              return (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setPage('loyers')}>
                  <td><b>{l.nom_locataire}</b></td>
                  <td>{bat ? bat.nom : ''} {l.numero_porte || ''}</td>
                  <td className="num">{fcfa(l.situation.loyer)} F</td>
                  <td className="num"><span className="badge retard">{fmtNombre(l.situation.dette_mois)} mois</span></td>
                  <td className="num" style={{ color: 'var(--rouge)', fontWeight: 700 }}>{fcfa(l.situation.dette)} F</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
