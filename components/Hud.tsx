'use client';

import { HELP_PAGES } from '@/lib/game/engine';
import { getMode, useOffice } from '@/lib/store';
import Portrait from './Portrait';

export default function Hud() {
  const name = useOffice(s => s.player.name);
  const zone = useOffice(s => s.zone);
  const { openModal, openDialog, toggleTeam } = useOffice.getState();
  // HUD buttons only work while walking around, not mid-conversation.
  const whenPlaying = (fn: () => void) => () => {
    if (getMode(useOffice.getState()) === 'play') fn();
  };

  return (
    <header id="hud">
      <div className="hud-chip">
        <Portrait id="me" />
        <div>
          <div id="me-name">{name}</div>
          <div id="zone-name">{zone ?? 'Open Office'}</div>
        </div>
      </div>
      <nav className="hud-actions">
        <button className="pixel-btn" onClick={whenPlaying(() => openModal({ kind: 'person', id: 'me' }))}>My tasks</button>
        <button className="pixel-btn" onClick={whenPlaying(() => openModal({ kind: 'board' }))}>Board <kbd>B</kbd></button>
        <button className="pixel-btn" onClick={whenPlaying(() => toggleTeam())}>Team <kbd>T</kbd></button>
        <button className="pixel-btn" aria-label="Help" onClick={whenPlaying(() => openDialog({ pages: HELP_PAGES, speaker: 'HELP' }))}>?</button>
      </nav>
    </header>
  );
}
