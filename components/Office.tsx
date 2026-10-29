'use client';

import { useEffect, useState } from 'react';
import { savedPlayer } from '@/lib/player';
import { useOffice } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import { fetchBoard, syncConnectors, toOffice, type OfficeRows } from '@/lib/supabase/office';
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

  // Returning players skip the start screen and the tips. Decided after mount,
  // because demo mode remembers you in localStorage, which the server can't see.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const saved = savedPlayer(account);
    if (saved) {
      const { start, openDialog } = useOffice.getState();
      start(saved.name, saved.look);
      if (notice) openDialog({ pages: [notice] });
    }
    setChecked(true);
  }, [account, notice]);

  // Pull connected boards (Monday.com) in the background; the server skips it
  // if it ran in the last couple of minutes.
  useEffect(() => {
    const ws = useOffice.getState().workspace;
    if (!ws) return;
    syncConnectors(ws)
      .then(async r => { if (r.synced) useOffice.getState().loadBoard(await fetchBoard(ws)); })
      .catch(err => console.error('Board sync failed:', err.message));
  }, []);

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
      <ModalHost account={account} />
      {checked && !started && <StartScreen account={account} notice={notice} />}
    </>
  );
}
