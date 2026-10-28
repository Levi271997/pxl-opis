'use client';

import { WATER_GOAL } from '@/lib/data';
import { HELP_PAGES } from '@/lib/game/engine';
import { getMode, useOffice } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import { createClient } from '@/lib/supabase/client';
import Portrait from './Portrait';

async function signOut() {
  await createClient().auth.signOut();
  window.location.href = '/login';
}

export default function Hud({ account }: { account: Account | null }) {
  const name = useOffice(s => s.player.name);
  const zone = useOffice(s => s.zone);
  const cups = useOffice(s => s.waterCups);
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
        <div
          className={`water${cups >= WATER_GOAL ? ' full' : ''}`}
          title="Cups of water today. Visit a water cooler to drink."
        >
          <i className="drop" aria-hidden />
          {cups}/{WATER_GOAL}
        </div>
      </div>
      <nav className="hud-actions">
        <button className="pixel-btn" onClick={whenPlaying(() => openModal({ kind: 'person', id: 'me' }))}>My tasks</button>
        <button className="pixel-btn" onClick={whenPlaying(() => openModal({ kind: 'board' }))}>Board <kbd>B</kbd></button>
        <button className="pixel-btn" onClick={whenPlaying(() => toggleTeam())}>Team <kbd>T</kbd></button>
        <button className="pixel-btn" aria-label="Help" onClick={whenPlaying(() => openDialog({ pages: HELP_PAGES, speaker: 'HELP' }))}>?</button>
        {account && <button className="pixel-btn" title={account.email} onClick={signOut}>Sign out</button>}
      </nav>
    </header>
  );
}
