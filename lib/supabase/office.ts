// Turns the workspace's database rows into the shapes the office uses, and
// writes task changes back. Rows are loaded on the server (loadOffice in
// server.ts); the conversion runs in the browser so "due in N days" uses the
// viewer's own calendar.

import { BOT_SLOTS, DESK_SLOTS, PLAYER_START, STARTER_LOOKS, type Coworker, type Dir, type Look, type Presence, type Priority, type Project, type StatusId, type Task } from '../data';
import { createClient } from './client';

export interface MemberRow {
  id: string;
  user_id: string | null;
  role: MemberRole;
  display_name: string;
  role_title: string;
  presence: Presence;
  look: Look | null;
  desk_x: number | null;
  desk_y: number | null;
  home_dir: Dir;
  wander: Coworker['wander'] | null;
  greeting: string[];
  blocker: string | null;
}

export interface BotRow {
  id: string;
  name: string;
  role_title: string;
  greeting: string;
  look: Look | null;
  desk_x: number | null;
  desk_y: number | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  source?: 'local' | 'monday';
}

export interface TaskRow {
  id: string;
  project_id: string | null;
  assignee_id: string | null;
  code: string | null;
  title: string;
  status: StatusId;
  priority: Priority;
  due_date: string | null; // YYYY-MM-DD
}

export interface OfficeRows {
  workspaceId: string;
  userId: string;
  members: MemberRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
  bots: BotRow[];
}

// What the store needs to talk to the database. null in demo mode.
export interface Workspace {
  id: string;
  meId: string; // the signed-in user's row in members
  role: MemberRole; // the signed-in user's role
}

export type MemberRole = 'owner' | 'admin' | 'member';
export const ROLE_LABELS: Record<MemberRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
export const canManageTeam = (ws: Workspace | null) => ws?.role === 'owner' || ws?.role === 'admin';

export interface OfficeData {
  workspace: Workspace;
  coworkers: Coworker[];
  projects: Record<string, Project>;
  tasks: Task[];
}

const DAY = 24 * 60 * 60 * 1000;

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(date: string | null) {
  if (!date) return 7;
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today().getTime()) / DAY);
}

function dateIn(days: number) {
  const d = today();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Bots sit in the AI corner unless they have a saved spot. They don't wander.
function toBots(bots: BotRow[]): Coworker[] {
  const free = BOT_SLOTS.slice();
  return bots.map((b, i) => {
    const spot = b.desk_x !== null && b.desk_y !== null ? { x: b.desk_x, y: b.desk_y } : free.shift() ?? PLAYER_START;
    return {
      id: b.id,
      name: b.name,
      role: b.role_title,
      status: 'online',
      x: spot.x,
      y: spot.y,
      dir: 'down',
      look: b.look ?? STARTER_LOOKS[i % STARTER_LOOKS.length],
      greeting: [b.greeting],
      blocker: '',
      bot: true,
    };
  });
}

export function toOffice(rows: OfficeRows): OfficeData | null {
  const me = rows.members.find(m => m.user_id === rows.userId);
  if (!me) return null;

  // Teammates without a saved desk get the next free desk slot, in the order
  // they joined; the engine nudges anyone left over to a free tile.
  const others = rows.members.filter(m => m.id !== me.id);
  const used = new Set(others.filter(m => m.desk_x !== null).map(m => `${m.desk_x},${m.desk_y}`));
  const freeDesks = DESK_SLOTS.filter(d => !used.has(`${d.x},${d.y}`));
  const coworkers: Coworker[] = others.map((m, i) => {
    const desk = m.desk_x !== null && m.desk_y !== null ? { x: m.desk_x, y: m.desk_y } : freeDesks.shift() ?? PLAYER_START;
    return {
      id: m.id,
      name: m.display_name,
      role: m.role_title || ROLE_LABELS[m.role],
      status: m.presence,
      x: desk.x,
      y: desk.y,
      dir: m.home_dir,
      wander: m.wander ?? undefined,
      look: m.look ?? STARTER_LOOKS[i % STARTER_LOOKS.length],
      greeting: m.greeting.length ? m.greeting : [`Hi, I'm ${m.display_name}.`],
      blocker: m.blocker ?? 'Nothing blocking me right now.',
    };
  });

  return {
    workspace: { id: rows.workspaceId, meId: me.id, role: me.role },
    coworkers: [...coworkers, ...toBots(rows.bots)],
    projects: toProjects(rows.projects),
    tasks: toTasks(rows.tasks, me.id),
  };
}

const toProjects = (rows: ProjectRow[]): Record<string, Project> =>
  Object.fromEntries(rows.map(p => [p.id, { name: p.name, color: p.color, ...(p.source === 'monday' ? { source: 'monday' as const } : {}) }]));

const toTasks = (rows: TaskRow[], meId: string): Task[] => rows.map(t => ({
  id: t.id,
  code: t.code ?? undefined,
  title: t.title,
  project: t.project_id ?? '',
  assignee: t.assignee_id === meId ? 'me' : t.assignee_id ?? '',
  status: t.status,
  priority: t.priority,
  dueIn: daysUntil(t.due_date),
}));

// Projects and tasks again, after a sync changed them.
export async function fetchBoard(ws: Workspace) {
  const supabase = createClient();
  const [projects, tasks] = await Promise.all([
    supabase.from('projects').select('id, name, color, source').eq('workspace_id', ws.id).order('created_at'),
    supabase.from('tasks').select('id, project_id, assignee_id, code, title, status, priority, due_date').eq('workspace_id', ws.id).order('code'),
  ]);
  if (projects.error || tasks.error) throw new Error((projects.error ?? tasks.error)!.message);
  return { projects: toProjects(projects.data as ProjectRow[]), tasks: toTasks(tasks.data as TaskRow[], ws.meId) };
}

// Asks the server to pull Monday.com again. Returns true if anything was synced.
export async function syncConnectors(ws: Workspace, force = false) {
  const res = await fetch('/api/connectors/monday/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: ws.id, force }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Sync failed');
  return body as { synced: boolean; boards?: number; tasks?: number };
}

// Mirrors an office change to Monday.com (the office already saved it).
export async function pushTask(ws: Workspace, taskId: string, fields: string[]) {
  const res = await fetch('/api/connectors/monday/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: ws.id, taskId, fields }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Monday.com didn't accept the change.");
}

// Only the fields that were changed, as database columns.
function toRow(ws: Workspace, task: Partial<Task>) {
  const row: Partial<Omit<TaskRow, 'id'>> = {};
  if (task.code !== undefined) row.code = task.code;
  if (task.title !== undefined) row.title = task.title;
  if (task.status !== undefined) row.status = task.status;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.dueIn !== undefined) row.due_date = dateIn(task.dueIn);
  if (task.project !== undefined) row.project_id = task.project || null;
  if (task.assignee !== undefined) row.assignee_id = task.assignee === 'me' ? ws.meId : task.assignee || null;
  return row;
}

export async function saveTask(ws: Workspace, id: string, patch: Partial<Task>) {
  const { error } = await createClient().from('tasks').update(toRow(ws, patch)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function insertTask(ws: Workspace, task: Task) {
  const { error } = await createClient()
    .from('tasks')
    .insert({ id: task.id, workspace_id: ws.id, ...toRow(ws, task) });
  if (error) throw new Error(error.message);
}
