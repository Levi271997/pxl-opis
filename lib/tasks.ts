import { PRIORITY, STATUSES, type StatusId, type Task } from './data';

export const statusInfo = (id: StatusId) => STATUSES.find(s => s.id === id)!;

export function nextStatus(id: StatusId): StatusId {
  const i = STATUSES.findIndex(s => s.id === id);
  return STATUSES[(i + 1) % STATUSES.length].id;
}

export function byPriority(a: Task, b: Task) {
  return PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || a.dueIn - b.dueIn;
}

export function byStatusThenPriority(a: Task, b: Task) {
  const order = (s: StatusId) => STATUSES.findIndex(x => x.id === s);
  return order(a.status) - order(b.status) || byPriority(a, b);
}

export function nextTaskId(tasks: Task[]) {
  return 'T-' + (Math.max(...tasks.map(t => parseInt(t.id.slice(2), 10))) + 1);
}

export function dueLabel(days: number) {
  if (days < 0) return `Overdue ${-days}d`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

export function dueDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const firstName = (name: string) => name.split(' ')[0];
