import React from 'react';

export default function Modal({ titre, onFermer, children }) {
  return (
    <div className="modal-fond" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="modal">
        <h3>{titre}</h3>
        {children}
      </div>
    </div>
  );
}
