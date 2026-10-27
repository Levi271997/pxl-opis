'use client';

import { COWORKERS, PRESENCE, type Presence } from '@/lib/data';
import { engineRef } from '@/lib/game/engine';
import { getPerson, useOffice } from '@/lib/store';
import { byPriority, firstName } from '@/lib/tasks';
import Portrait from './Portrait';
import type { CSSVars } from './TaskCard';

const PRESENCE_ORDER: Presence[] = ['online', 'busy', 'away'];

// The bulletin board in the open office: everyone's presence and what
// they're working on right now.
export default function StatusBoard() {
  const tasks = useOffice(s => s.tasks);
  const playerName = useOffice(s => s.player.name);
  const { openModal, closeModal } = useOffice.getState();

  const people = [getPerson('me', playerName), ...COWORKERS];
  const totals = PRESENCE_ORDER.map(p => [p, people.filter(x => x.status === p).length] as const);

  return (
    <div className="status-board">
      <div className="presence-summary">
        {totals.map(([p, n]) => (
          <span key={p} className="presence-pill" style={{ '--c': PRESENCE[p].color } as CSSVars}>
            <i />{n} {PRESENCE[p].label.toLowerCase()}
          </span>
        ))}
      </div>

      <div className="status-grid">
        {people.map(p => {
          const mine = tasks.filter(t => t.assignee === p.id);
          const doing = mine.filter(t => t.status === 'doing').sort(byPriority);
          const count = (s: string) => mine.filter(t => t.status === s).length;
          const presence = PRESENCE[p.status];
          return (
            <article key={p.id} className="status-card" style={{ '--c': presence.color } as CSSVars}>
              <header>
                <Portrait id={p.id} className="portrait mid" />
                <div className="status-who">
                  <strong>{p.id === 'me' ? `${p.name} (you)` : p.name}</strong>
                  <span>{p.role}</span>
                </div>
                <span className="status-light" title={presence.label}>{presence.label}</span>
              </header>
              <p className="working-on">
                <span>Working on</span>
                {doing.length ? doing[0].title : <em>Nothing in progress</em>}
                {doing.length > 1 && <small> +{doing.length - 1} more</small>}
              </p>
              <div className="status-counts">
                <span><b>{count('todo')}</b> to do</span>
                <span><b>{count('doing')}</b> doing</span>
                <span><b>{count('review')}</b> review</span>
                <span><b>{count('done')}</b> done</span>
              </div>
              <div className="status-actions">
                <button className="mini-btn" onClick={() => openModal({ kind: 'person', id: p.id })}>Tasks</button>
                {p.id !== 'me' && (
                  <button
                    className="mini-btn"
                    title={`Walk over to ${firstName(p.name)}`}
                    onClick={() => { closeModal(); engineRef.current?.walkToPerson(p.id); }}
                  >
                    Go
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
