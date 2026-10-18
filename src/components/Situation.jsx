import React from 'react';
import { situationBadge } from '../utils/format.js';

export default function Situation({ sit, statut }) {
  const b = situationBadge(sit, statut);
  return <span className={`badge ${b.classe}`}>{b.texte}</span>;
}
