import React from 'react';
import { moisLabel, moisPrecedent, moisSuivant } from '../utils/format.js';

export default function SelecteurMois({ mois, onChange }) {
  return (
    <div className="selecteur-mois">
      <button onClick={() => onChange(moisPrecedent(mois))} title="Mois précédent">◀</button>
      <span>{moisLabel(mois)}</span>
      <button onClick={() => onChange(moisSuivant(mois))} title="Mois suivant">▶</button>
    </div>
  );
}
