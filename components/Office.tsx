'use client';

import { useState } from 'react';
import { useOffice } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import { toOffice, type OfficeRows } from '@/lib/supabase/office';
import DialogBox from './DialogBox';
import GameCanvas from './GameCanvas';
import Hud from './Hud';
import ModalHost from './ModalHost';
import StartScreen from './StartScreen';
import TeamPanel from './TeamPanel';
import ZoneBanner from './ZoneBanner';

export default function Office({ account, office, notice }: {
  account: Account | null;
  office: OfficeRows | null;
  notice: string | null; // e.g. after accepting an invite
}) {
  // Fill the store before anything mounts: the canvas engine places the
  // coworkers once, when it starts. Without a workspace the demo data stays.
  // Browser only: on the server the store is shared by every request.
  useState(() => {
    if (typeof window === 'undefined') return;
    const data = office && toOffice(office);
    if (data) useOffice.getState().load(data);
  });

  const started = useOffice(s => s.started);
  const talking = useOffice(s => s.dialog !== null);

  return (
    <>
      <GameCanvas />
      {started && <Hud account={account} />}
      <ZoneBanner />
      <TeamPanel />
      {started && !talking && (
        <p id="hint">
          <kbd>WASD</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> talk · click to walk
        </p>
      )}
      <DialogBox />
      <ModalHost />
      {!started && <StartScreen account={account} notice={notice} />}
    </>
  );
}
