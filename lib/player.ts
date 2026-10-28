// Remembering who you are between visits. Signed in, your name and avatar
// live in your profile (and your member row, so teammates see them). In demo
// mode they're kept in this browser.

import type { Look } from './data';
import type { Account } from './supabase/account';
import { createClient } from './supabase/client';
import type { Workspace } from './supabase/office';

const DEMO_KEY = 'pxl-opis:player';

export interface SavedPlayer { name: string; look: Look }

// Who to drop straight into the office, or null for a first visit.
export function savedPlayer(account: Account | null): SavedPlayer | null {
  if (account) return account.look ? { name: account.name, look: account.look } : null;
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null');
    return saved?.name && saved?.look ? saved : null;
  } catch {
    return null;
  }
}

// Saves in the background: the office doesn't wait for it.
export function savePlayer(player: SavedPlayer, account: Account | null, workspace: Workspace | null) {
  if (!account) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(player));
    } catch {
      // Storage blocked (private window): you'll just see the start screen again.
    }
    return;
  }
  const supabase = createClient();
  supabase
    .from('profiles')
    .upsert({ id: account.id, display_name: player.name, look: player.look })
    .then(({ error }) => { if (error) console.warn('Could not save profile:', error.message); });
  if (workspace) {
    supabase
      .from('members')
      .update({ display_name: player.name, look: player.look })
      .eq('id', workspace.meId)
      .then(({ error }) => { if (error) console.warn('Could not update your member name:', error.message); });
  }
}
