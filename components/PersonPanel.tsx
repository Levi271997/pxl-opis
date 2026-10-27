'use client';

import { useMemo, useState } from 'react';
import { PRESENCE, PRIORITY, PROJECTS, STATUSES, type Priority, type ProjectId } from '@/lib/data';
import { getPerson, useOffice } from '@/lib/store';
import { byStatusThenPriority, firstName } from '@/lib/tasks';
import Portrait from './Portrait';
import TaskCard, { type CSSVars } from './TaskCard';

function AddTaskForm({ assignee, label }: { assignee: string; label: string }) {
  const addTask = useOffice(s => s.addTask);
  const [title, setTitle] = useState('');
  const [project, setProject] = useState<ProjectId>('web');
  const [priority, setPriority] = useState<Priority>('med');

  return (
    <>
      <h4 className="section-label">{label}</h4>
      <form
        className="add-task"
        onSubmit={e => {
          e.preventDefault();
          if (!title.trim()) return;
          addTask({ title: title.trim(), project, assignee, status: 'todo', priority, dueIn: 7 });
          setTitle('');
        }}
      >
        <input
          type="text" placeholder="New task title…" maxLength={80} aria-label="Task title"
          value={title} onChange={e => setTitle(e.target.value)}
        />
        <select aria-label="Project" value={project} onChange={e => setProject(e.target.value as ProjectId)}>
          {Object.entries(PROJECTS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
        </select>
        <select aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
          {Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
        <button className="pixel-btn small" type="submit">Add</button>
      </form>
    </>
  );
}

export default function PersonPanel({ id }: { id: string }) {
  const allTasks = useOffice(s => s.tasks);
  const playerName = useOffice(s => s.player.name);
  const person = getPerson(id, playerName);
  const presence = PRESENCE[person.status];
  const tasks = useMemo(() => allTasks.filter(t => t.assignee === id).sort(byStatusThenPriority), [allTasks, id]);

  return (
    <div className="person">
      <header className="person-head">
        <Portrait id={id} className="portrait big" />
        <div>
          <h3>{person.name}</h3>
          <p>{person.role}</p>
          <p className="presence"><i style={{ background: presence.color }} />{presence.label}</p>
        </div>
      </header>

      <div className="stats">
        {STATUSES.map(s => (
          <div key={s.id} className="stat" style={{ '--c': s.color } as CSSVars}>
            <b>{tasks.filter(t => t.status === s.id).length}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {tasks.length
        ? <div className="card-list">{tasks.map(t => <TaskCard key={t.id} task={t} showAssignee={false} />)}</div>
        : <p className="empty">No tasks yet.</p>}

      <AddTaskForm
        assignee={id}
        label={id === 'me' ? 'Add a task for yourself' : `Assign ${firstName(person.name)} a task`}
      />
    </div>
  );
}
