'use client';

import { useState } from 'react';
import { savePlayer } from '@/lib/player';
import { useOffice } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import CharacterEditor from './CharacterEditor';

// The Character modal: change your name and avatar after the first visit.
export default function CharacterSettings({ account }: { account: Account | null }) {
  const player = useOffice(s => s.player);
  const [name, setName] = useState(player.name);
  const [look, setLook] = useState(player.look);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { name: name.trim() || 'You', look };
    const { setPlayer, closeModal, workspace } = useOffice.getState();
    setPlayer(next.name, next.look);
    savePlayer(next, account, workspace);
    closeModal();
  };

  return (
    <form className="character-settings" onSubmit={save}>
      <CharacterEditor name={name} look={look} onName={setName} onLook={setLook} />
      <div className="character-actions">
        <button className="pixel-btn" type="button" onClick={() => useOffice.getState().closeModal()}>Cancel</button>
        <button className="pixel-btn" type="submit">Save</button>
      </div>
    </form>
  );
}
