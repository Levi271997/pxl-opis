'use client';

import { useState } from 'react';
import { DEFAULT_LOOK, type Look } from '@/lib/data';
import { savePlayer } from '@/lib/player';
import { useOffice } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import CharacterEditor from './CharacterEditor';

// Only shown on your first visit: pick a name and avatar. After that you go
// straight into the office, and can change them under Character.
export default function StartScreen({ account, notice }: { account: Account | null; notice: string | null }) {
  const [name, setName] = useState(account?.name ?? '');
  const [look, setLook] = useState<Look>(account?.look ?? DEFAULT_LOOK);

  const enter = (e: React.FormEvent) => {
    e.preventDefault();
    const playerName = name.trim() || 'You';
    const { start, openDialog, workspace } = useOffice.getState();
    start(playerName, look);
    savePlayer({ name: playerName, look }, account, workspace);
    openDialog({
      speaker: 'TIP',
      pages: [
        `Welcome to the office, ${playerName}!`,
        'Walk up to a coworker and press E to see what they are working on.',
        'The whiteboard in the Meeting Room opens the project board. Press ? for all controls.',
        'You can change your name and look any time under Character.',
      ],
    });
  };

  return (
    <div id="start">
      <form className="start-card" onSubmit={enter}>
        <h1>Pxl Opis</h1>
        <p className="sub">Project management, but you walk to your desk.</p>
        {account && <p className="signed-in-as">Signed in as {account.email}</p>}
        {notice && <p className="start-notice" role="status">{notice}</p>}
        <CharacterEditor name={name} look={look} onName={setName} onLook={setLook} autoFocus />
        <button className="pixel-btn big" type="submit">Enter the office ▶</button>
      </form>
    </div>
  );
}
