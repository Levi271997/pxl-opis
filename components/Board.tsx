'use client';

import { useState } from 'react';
import { PROJECTS, STATUSES, type ProjectId } from '@/lib/data';
import { useOffice } from '@/lib/store';
import { byPriority } from '@/lib/tasks';
import TaskCard, { type CSSVars } from './TaskCard';

const FILTERS: [ProjectId | 'all', { name: string; color: string }][] = [
  ['all', { name: 'All projects', color: '#2b2840' }],
  ...(Object.entries(PROJECTS) as [ProjectId, { name: string; color: string }][]),
];

export default function Board() {
  const tasks = useOffice(s => s.tasks);
  const updateTask = useOffice(s => s.updateTask);
  const [filter, setFilter] = useState<ProjectId | 'all'>('all');
  const [over, setOver] = useState<string | null>(null);

  const visible = tasks.filter(t => filter === 'all' || t.project === filter);
  const done = visible.filter(t => t.status === 'done').length;

  return (
    <div className="board-wrap">
      <div className="chips">
        {FILTERS.map(([k, p]) => (
          <button
            key={k}
            className={`chip${filter === k ? ' active' : ''}`}
            style={{ '--c': p.color } as CSSVars}
            onClick={() => setFilter(k)}
          >
            {p.name}
          </button>
        ))}
        <span className="progress">
          {done}/{visible.length} done
          <span className="bar"><span style={{ width: `${visible.length ? (done / visible.length) * 100 : 0}%` }} /></span>
        </span>
      </div>

      <div className="board">
        {STATUSES.map(s => {
          const items = visible.filter(t => t.status === s.id).sort(byPriority);
          return (
            <section
              key={s.id}
              className={`col${over === s.id ? ' over' : ''}`}
              onDragOver={e => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={e => {
                e.preventDefault();
                setOver(null);
                updateTask(e.dataTransfer.getData('text/plain'), { status: s.id });
              }}
            >
              <h4 className="col-head" style={{ '--c': s.color } as CSSVars}>
                {s.label}<span>{items.length}</span>
              </h4>
              {items.map(t => <TaskCard key={t.id} task={t} draggable />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
