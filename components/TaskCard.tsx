'use client';

import { PRIORITY, PROJECTS, type Task } from '@/lib/data';
import { engineRef } from '@/lib/game/engine';
import { getPerson, useOffice } from '@/lib/store';
import { dueDate, dueLabel, firstName, nextStatus, statusInfo } from '@/lib/tasks';
import Portrait from './Portrait';

type CSSVars = React.CSSProperties & { '--c'?: string };

function AssigneeChip({ id }: { id: string }) {
  const playerName = useOffice(s => s.player.name);
  const closeModal = useOffice(s => s.closeModal);
  const person = getPerson(id, playerName);
  return (
    <span className="assignee">
      <Portrait id={id} />
      <span>{id === 'me' ? 'You' : firstName(person.name)}</span>
      {id !== 'me' && (
        <button
          className="go-btn"
          title={`Walk over to ${firstName(person.name)}`}
          onClick={() => { closeModal(); engineRef.current?.walkToPerson(id); }}
        >
          Go
        </button>
      )}
    </span>
  );
}

export default function TaskCard({ task, showAssignee = true, draggable = false }: {
  task: Task;
  showAssignee?: boolean;
  draggable?: boolean;
}) {
  const updateTask = useOffice(s => s.updateTask);
  const proj = PROJECTS[task.project];
  const st = statusInfo(task.status);
  const pr = PRIORITY[task.priority];
  const dueCls = task.dueIn < 0 ? ' overdue' : task.dueIn <= 1 ? ' soon' : '';

  return (
    <article
      className={`card${task.status === 'done' ? ' is-done' : ''}`}
      draggable={draggable || undefined}
      onDragStart={e => { e.dataTransfer.setData('text/plain', task.id); e.currentTarget.classList.add('dragging'); }}
      onDragEnd={e => e.currentTarget.classList.remove('dragging')}
    >
      <div className="card-top">
        <span className="tag" style={{ '--c': proj.color } as CSSVars}>{proj.name}</span>
        <span className="card-id">{task.id}</span>
      </div>
      <h4 className="card-title">{task.title}</h4>
      <div className="card-meta">
        <span className={`prio prio-${task.priority}`}>{pr.icon} {pr.label}</span>
        {task.status !== 'done' && (
          <span className={`due${dueCls}`} title={dueDate(task.dueIn)}>{dueLabel(task.dueIn)}</span>
        )}
      </div>
      <div className="card-foot">
        {showAssignee ? <AssigneeChip id={task.assignee} /> : <span />}
        <button
          className="status-btn"
          style={{ '--c': st.color } as CSSVars}
          title="Move to the next status"
          onClick={() => updateTask(task.id, { status: nextStatus(task.status) })}
        >
          {st.label} &gt;
        </button>
      </div>
    </article>
  );
}

export type { CSSVars };
