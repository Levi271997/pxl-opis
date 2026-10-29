// Board sync: copies the picked Monday.com boards into the office (boards ->
// projects, items -> tasks, people -> teammates by email), and sends office
// changes back. Server only, with the secret-key client, after checkAccess.

import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from './crypto';
import type { StatusId } from '../data';
import { createItem, readBoard, updateItem, usersByIds, type BoardSync, type Item, type TaskFields } from './monday';

export interface PickedBoard { id: string; name: string }
export interface SyncSettings { boards?: PickedBoard[] }

const COLORS = ['#ff3d57', '#00c875', '#fdab3d', '#579bfc', '#a25ddc', '#ff7575', '#037f4c', '#e2445c'];

export async function connection(admin: SupabaseClient, workspaceId: string) {
  const { data } = await admin
    .from('integrations')
    .select('access_token, scope, settings, synced_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'monday')
    .maybeSingle();
  if (!data) return null;
  return {
    token: decrypt(data.access_token as string),
    canWrite: !data.scope || String(data.scope).includes('boards:write'),
    settings: (data.settings ?? {}) as SyncSettings,
    syncedAt: data.synced_at as string | null,
  };
}

// Monday person id -> member id, matched on the email they signed in with.
async function matchPeople(admin: SupabaseClient, workspaceId: string, token: string, mondayIds: string[]) {
  const people = await usersByIds(token, mondayIds);
  const { data: members } = await admin.from('members').select('id, user_id').eq('workspace_id', workspaceId);
  const byEmail = new Map<string, string>();
  for (const m of members ?? []) {
    if (!m.user_id) continue;
    const { data } = await admin.auth.admin.getUserById(m.user_id as string);
    if (data.user?.email) byEmail.set(data.user.email.toLowerCase(), m.id as string);
  }
  const map = new Map<string, string>();
  for (const p of people) {
    const member = p.email ? byEmail.get(p.email.toLowerCase()) : undefined;
    if (!member) continue;
    map.set(String(p.id), member);
    await admin.from('members').update({ external_ref: String(p.id) }).eq('id', member);
  }
  return map;
}

export async function syncMonday(admin: SupabaseClient, workspaceId: string, token: string, boards: PickedBoard[]) {
  const keep = boards.map(b => b.id);

  // Boards that were un-picked leave the office, with their tasks.
  const { data: oldProjects } = await admin
    .from('projects').select('id, external_ref').eq('workspace_id', workspaceId).eq('source', 'monday');
  const dropped = (oldProjects ?? []).filter(p => !keep.includes(p.external_ref as string)).map(p => p.id as string);
  if (dropped.length) {
    await admin.from('tasks').delete().in('project_id', dropped);
    await admin.from('projects').delete().in('id', dropped);
  }

  const read = [];
  for (const b of boards) {
    const board = await readBoard(token, b.id);
    if (board) read.push({ id: b.id, ...board });
  }
  const people = await matchPeople(admin, workspaceId, token, [...new Set(read.flatMap(b => b.items.flatMap(i => i.people ?? [])))]);

  let tasks = 0;
  for (const [i, board] of read.entries()) {
    const old = oldProjects?.find(p => p.external_ref === board.id);
    const { data: project, error } = await admin.from('projects').upsert({
      workspace_id: workspaceId,
      source: 'monday',
      external_ref: board.id,
      name: board.name,
      sync: board.sync,
      ...(old ? {} : { color: COLORS[i % COLORS.length] }),
    }, { onConflict: 'workspace_id,source,external_ref' }).select('id').single();
    if (error || !project) throw new Error(`Saving the board ${board.name} failed: ${error?.message}`);

    // What the office already has, for fields this board has no column for.
    const { data: existing } = await admin
      .from('tasks').select('id, external_ref, status, priority, due_date, assignee_id').eq('project_id', project.id).eq('source', 'monday');
    const before = new Map((existing ?? []).map(t => [t.external_ref as string, t]));

    const rows = board.items.map(item => {
      const was = before.get(item.id);
      const assignee = item.people?.map(p => people.get(p)).find(Boolean);
      return {
        workspace_id: workspaceId,
        project_id: project.id,
        source: 'monday',
        external_ref: item.id,
        title: item.name,
        status: keepStatus(board.sync, was?.status, item),
        priority: item.priority ?? was?.priority ?? 'med',
        due_date: item.due !== undefined ? item.due : was?.due_date ?? null,
        assignee_id: item.people ? assignee ?? null : was?.assignee_id ?? null,
      };
    });
    if (rows.length) {
      const { error: saveError } = await admin.from('tasks').upsert(rows, { onConflict: 'workspace_id,source,external_ref' });
      if (saveError) throw new Error(`Saving the items of ${board.name} failed: ${saveError.message}`);
    }
    // Items deleted in Monday.com leave the office too.
    const gone = (existing ?? []).filter(t => !board.items.some(it => it.id === t.external_ref)).map(t => t.id as string);
    if (gone.length) await admin.from('tasks').delete().in('id', gone);
    tasks += rows.length;
  }

  await admin.from('integrations')
    .update({ synced_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('provider', 'monday');
  return { boards: read.length, tasks };
}

// Boards without a label for every column (say, no "Review") get the nearest
// one written back. Keep the office's status while Monday still shows the label
// the office would have written for it.
function keepStatus(sync: BoardSync, was: StatusId | undefined, item: Item) {
  if (!was || !sync.status) return item.status;
  const written = sync.status.labels[was];
  return written !== undefined && (written ?? null) === item.label ? was : item.status;
}

// Sends one task's changed fields (already saved in the office) to Monday.com.
// A new task on a Monday board becomes a new item there.
export async function pushTask(admin: SupabaseClient, workspaceId: string, token: string, taskId: string, fields: string[]) {
  const { data: task } = await admin
    .from('tasks').select('id, project_id, source, external_ref, title, status, priority, due_date')
    .eq('id', taskId).eq('workspace_id', workspaceId).maybeSingle();
  if (!task?.project_id) return { skipped: true };
  const { data: project } = await admin
    .from('projects').select('source, sync').eq('id', task.project_id).eq('workspace_id', workspaceId).maybeSingle();
  if (project?.source !== 'monday' || !project.sync) return { skipped: true };
  const sync = project.sync as BoardSync;

  const all: TaskFields = { title: task.title, status: task.status, priority: task.priority, due: task.due_date };
  if (task.source !== 'monday' || !task.external_ref) {
    const itemId = await createItem(token, sync, { ...all, title: task.title });
    await admin.from('tasks').update({ source: 'monday', external_ref: itemId }).eq('id', task.id);
    return { created: itemId };
  }

  const changed: TaskFields = {};
  if (fields.includes('title')) changed.title = all.title;
  if (fields.includes('status')) changed.status = all.status;
  if (fields.includes('priority')) changed.priority = all.priority;
  if (fields.includes('dueIn')) changed.due = all.due;
  await updateItem(token, sync, task.external_ref, changed);
  return { updated: task.external_ref };
}
