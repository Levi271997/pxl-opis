'use client';

import { useEffect } from 'react';
import { getPerson, useOffice } from '@/lib/store';
import { firstName } from '@/lib/tasks';
import Board from './Board';
import PersonPanel from './PersonPanel';

export default function ModalHost() {
  const modal = useOffice(s => s.modal);
  const playerName = useOffice(s => s.player.name);
  const closeModal = useOffice(s => s.closeModal);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || (k === 'b' && modal.kind === 'board')) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  if (!modal) return null;

  const heading = modal.kind === 'board'
    ? 'Project board'
    : modal.id === 'me' ? 'My tasks' : `${firstName(getPerson(modal.id, playerName).name)}'s desk`;

  return (
    <div
      id="modal-root"
      className={modal.kind === 'board' ? 'wide' : undefined}
      onPointerDown={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <h2 id="modal-title">{heading}</h2>
          <button className="icon-btn" aria-label="Close" onClick={closeModal}>×</button>
        </div>
        <div id="modal-body">
          {modal.kind === 'board' ? <Board /> : <PersonPanel id={modal.id} />}
        </div>
      </div>
    </div>
  );
}
