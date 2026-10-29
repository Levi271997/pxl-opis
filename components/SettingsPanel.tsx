'use client';

import { useState } from 'react';
import type { SettingsTab } from '@/lib/store';
import type { Account } from '@/lib/supabase/account';
import CharacterSettings from './CharacterSettings';
import ConnectorsPanel from './ConnectorsPanel';
import TeamManager from './TeamManager';
import type { CSSVars } from './TaskCard';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'character', label: 'Character' },
  { id: 'team', label: 'Team' },
  { id: 'connectors', label: 'Connectors' },
];

// The HUD's Settings window: your character, the team, and connected tools.
export default function SettingsPanel({ account, tab: initial = 'character' }: { account: Account | null; tab?: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(initial);
  return (
    <div className="settings">
      <div className="chips settings-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`chip${tab === t.id ? ' active' : ''}`}
            style={{ '--c': '#2b2840' } as CSSVars}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'character' && <CharacterSettings account={account} />}
      {tab === 'team' && <TeamManager />}
      {tab === 'connectors' && <ConnectorsPanel />}
    </div>
  );
}
