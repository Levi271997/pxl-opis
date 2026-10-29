'use client';

import { PRESENCE } from '@/lib/data';
import { engineRef } from '@/lib/game/engine';
import { getPerson, isBot, useOffice } from '@/lib/store';
import Portrait from './Portrait';

export default function TeamPanel() {
  const open = useOffice(s => s.teamOpen);
  const tasks = useOffice(s => s.tasks);
  const playerName = useOffice(s => s.player.name);
  const coworkers = useOffice(s => s.coworkers);
  const signedIn = useOffice(s => s.workspace !== null);
  const { toggleTeam, openModal } = useOffice.getState();
  if (!open) return null;

  const people = [getPerson('me', playerName), ...coworkers];
  const here = coworkers.filter(c => c.status !== 'away').length + 1;

  return (
    <aside className="team">
      <div className="team-head">
        <span>Team</span>
        <span id="team-count">{here} in the office</span>
        {signedIn && <button className="mini-btn" onClick={() => openModal({ kind: 'manage-team' })}>Manage</button>}
        <button className="icon-btn" aria-label="Close team list" onClick={() => toggleTeam(false)}>×</button>
      </div>
      <ul id="team-list">
        {people.map(p => {
          const openCount = tasks.filter(t => t.assignee === p.id && t.status !== 'done').length;
          return (
            <li key={p.id} className="member">
              <Portrait id={p.id} />
              <div className="member-info">
                <strong>
                  <i className="dot" style={{ background: PRESENCE[p.status].color }} />
                  {p.id === 'me' ? `${p.name} (you)` : p.name}
                </strong>
                <span>{p.role} · {isBot(p.id) ? <span className="bot-badge">Bot</span> : `${openCount} open`}</span>
              </div>
              <div className="member-actions">
                {isBot(p.id)
                  ? <button className="mini-btn" onClick={() => openModal({ kind: 'bot', id: p.id })}>Chat</button>
                  : <button className="mini-btn" onClick={() => openModal({ kind: 'person', id: p.id })}>Tasks</button>}
                {p.id !== 'me' && (
                  <button className="mini-btn" onClick={() => engineRef.current?.walkToPerson(p.id)}>Go</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
