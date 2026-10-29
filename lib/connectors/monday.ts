// Talking to Monday.com's GraphQL API, and translating between its boards and
// the office's tasks. Server only: it is handed a decrypted access token.

import type { Priority, StatusId } from '../data';

const API = 'https://api.monday.com/v2';
const PAGE = 500;
const MAX_ITEMS = 2000; // per board, so one huge board can't stall a sync

export async function monday<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  const problem = body?.errors?.[0]?.message ?? body?.error_message;
  if (!res.ok || !body?.data || problem) throw new Error(`Monday.com: ${problem ?? `request failed (${res.status})`}`);
  return body.data as T;
}

export interface BoardSummary { id: string; name: string; workspace: string | null; items: number }

export async function listBoards(token: string): Promise<BoardSummary[]> {
  const data = await monday<{ boards: { id: string; name: string; type: string | null; items_count: number | null; workspace: { name: string } | null }[] }>(
    token,
    'query { boards(limit: 200, state: active, order_by: used_at) { id name type items_count workspace { name } } }',
  );
  return data.boards
    .filter(b => !b.type || b.type === 'board') // skip subitem boards and docs
    .map(b => ({ id: b.id, name: b.name, workspace: b.workspace?.name ?? null, items: b.items_count ?? 0 }));
}

// ---------------------------------------------------------------------------
// Which columns mean what
// ---------------------------------------------------------------------------

interface Label { label: string; done: boolean }
interface Column { id: string; title: string; type: string; settings: unknown }

// Saved on the project (projects.sync) so changes can be written back.
export interface BoardSync {
  board: string;
  status?: { column: string; labels: Partial<Record<StatusId, string | null>> };
  priority?: { column: string; labels: Partial<Record<Priority, string>> };
  date?: string;
  people?: string;
}

// Monday's status labels are free text, so guess from the words.
export function statusOf(label: string | null | undefined, done = false): StatusId {
  const l = (label ?? '').toLowerCase();
  if (done || /done|complete|finish|closed|shipped|resolved/.test(l)) return 'done';
  if (/review|qa\b|test|approv|feedback/.test(l)) return 'review';
  if (/not started|to ?do|backlog|new\b|planned/.test(l)) return 'todo';
  if (/progress|working|doing|stuck|blocked|active|started|wip/.test(l)) return 'doing';
  return 'todo';
}

export function priorityOf(label: string | null | undefined): Priority {
  const l = (label ?? '').toLowerCase();
  if (/critical|urgent|high/.test(l)) return 'high';
  if (/low/.test(l)) return 'low';
  return 'med';
}

// Status column settings: { labels: [{ label, is_done, is_deactivated }] } today,
// { labels: { "0": "Done" }, done_colors: [1] } in older API versions.
function labelsOf(settings: unknown): Label[] {
  const s = (typeof settings === 'string' ? safeJson(settings) : settings) as { labels?: unknown; done_colors?: number[] } | null;
  if (!s?.labels) return [];
  if (Array.isArray(s.labels)) {
    return s.labels
      .filter((l: { label?: string; is_deactivated?: boolean }) => l.label && !l.is_deactivated)
      .map((l: { label: string; is_done?: boolean }) => ({ label: l.label, done: l.is_done === true }));
  }
  return Object.entries(s.labels as Record<string, string>)
    .filter(([, label]) => label)
    .map(([i, label]) => ({ label, done: (s.done_colors ?? [1]).includes(Number(i)) }));
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

// Prefer a column whose title says what it is, else the first of that type.
const pick = (columns: Column[], types: string[], title: RegExp, not?: RegExp) => {
  const of = columns.filter(c => types.includes(c.type) && !(not && not.test(c.title)));
  return of.find(c => title.test(c.title)) ?? of[0];
};

export function boardSync(boardId: string, columns: Column[]): BoardSync {
  const sync: BoardSync = { board: boardId };
  const priority = pick(columns.filter(c => /priorit/i.test(c.title)), ['status'], /priorit/i);
  // A status column named like one, else the first with a "done" label (many
  // boards have several status columns, like "Client" or "Bundle or Standalone").
  const statusColumns = columns.filter(c => c.type === 'status' && !/priorit/i.test(c.title));
  const status = statusColumns.find(c => /^(status|stage|state|progress)\b/i.test(c.title))
    ?? statusColumns.find(c => /status|stage|progress/i.test(c.title))
    ?? statusColumns.find(c => labelsOf(c.settings).some(l => l.done));

  if (status) {
    const labels = labelsOf(status.settings);
    const out: Partial<Record<StatusId, string | null>> = {};
    for (const l of labels) {
      const s = statusOf(l.label, l.done);
      // "Done" beats other done-coloured labels; otherwise the first match wins.
      if (out[s] === undefined || (s === 'done' && /^done$/i.test(l.label))) out[s] = l.label;
    }
    if (out.review === undefined && out.doing) out.review = out.doing;
    if (out.todo === undefined) out.todo = null; // clear the status
    sync.status = { column: status.id, labels: out };
  }
  if (priority) {
    const out: Partial<Record<Priority, string>> = {};
    for (const l of labelsOf(priority.settings)) {
      const p = /medium|normal|\bmed\b/i.test(l.label) ? 'med' : priorityOf(l.label);
      out[p] ??= l.label;
    }
    sync.priority = { column: priority.id, labels: out };
  }
  // Only a date that means "due": start, created and done dates are left alone.
  const dates = columns.filter(c => c.type === 'date' && !/creat|start|done|complet/i.test(c.title));
  sync.date = (dates.find(c => /due|deadline/i.test(c.title)) ?? dates.find(c => /end|date|when/i.test(c.title)))?.id;
  sync.people = pick(columns, ['people', 'multiple-person'], /owner|assign|person|people/i)?.id;
  return sync;
}

// ---------------------------------------------------------------------------
// Reading a board
// ---------------------------------------------------------------------------

interface RawValue {
  id: string;
  text: string | null;
  label?: string | null;
  is_done?: boolean | null;
  date?: string | null;
  persons_and_teams?: { id: string; kind: string }[] | null;
}
interface RawItem { id: string; name: string; column_values: RawValue[] }

export interface Item {
  id: string;
  name: string;
  status: StatusId;
  label: string | null; // the status label as Monday shows it
  priority?: Priority; // only when the board has a priority column
  due?: string | null; // only when the board has a date column
  people?: string[]; // Monday user ids, only when the board has a people column
}

const ITEM_FIELDS = `id name column_values {
  id text
  ... on StatusValue { label is_done }
  ... on DateValue { date }
  ... on PeopleValue { persons_and_teams { id kind } }
}`;

export async function readBoard(token: string, id: string) {
  const data = await monday<{ boards: { id: string; name: string; columns: Column[]; items_page: { cursor: string | null; items: RawItem[] } }[] }>(
    token,
    `query ($id: [ID!]) { boards(ids: $id) { id name columns { id title type settings } items_page(limit: ${PAGE}) { cursor items { ${ITEM_FIELDS} } } } }`,
    { id: [id] },
  );
  const board = data.boards[0];
  if (!board) return null;

  const raw = board.items_page.items.slice();
  let cursor = board.items_page.cursor;
  while (cursor && raw.length < MAX_ITEMS) {
    const next = await monday<{ next_items_page: { cursor: string | null; items: RawItem[] } }>(
      token,
      `query ($cursor: String!) { next_items_page(cursor: $cursor, limit: ${PAGE}) { cursor items { ${ITEM_FIELDS} } } }`,
      { cursor },
    );
    raw.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  const sync = boardSync(board.id, board.columns);
  const items: Item[] = raw.map(it => {
    const value = (col?: string) => (col ? it.column_values.find(v => v.id === col) : undefined);
    const status = value(sync.status?.column);
    const label = status?.label || status?.text || null;
    const item: Item = { id: it.id, name: it.name, label, status: statusOf(label, status?.is_done === true) };
    if (sync.priority) { const p = value(sync.priority.column); item.priority = priorityOf(p?.label ?? p?.text); }
    if (sync.date) item.due = value(sync.date)?.date || null;
    if (sync.people) item.people = (value(sync.people)?.persons_and_teams ?? []).filter(p => p.kind === 'person').map(p => String(p.id));
    return item;
  });
  return { name: board.name, sync, items };
}

export async function usersByIds(token: string, ids: string[]) {
  if (!ids.length) return [];
  const data = await monday<{ users: { id: string; email: string | null; name: string }[] }>(
    token,
    'query ($ids: [ID!]) { users(ids: $ids) { id email name } }',
    { ids },
  );
  return data.users;
}

// ---------------------------------------------------------------------------
// Writing back
// ---------------------------------------------------------------------------

export interface TaskFields {
  title?: string;
  status?: StatusId;
  priority?: Priority;
  due?: string | null;
}

// Column values for change_multiple_column_values / create_item. Fields the
// board has no column for are skipped.
export function columnValues(sync: BoardSync, f: TaskFields) {
  const values: Record<string, unknown> = {};
  if (f.status && sync.status) {
    const label = sync.status.labels[f.status];
    if (label !== undefined) values[sync.status.column] = label === null ? null : { label };
  }
  if (f.priority && sync.priority?.labels[f.priority]) values[sync.priority.column] = { label: sync.priority.labels[f.priority] };
  if (f.due !== undefined && sync.date) values[sync.date] = f.due ? { date: f.due } : null;
  return values;
}

export async function updateItem(token: string, sync: BoardSync, itemId: string, f: TaskFields) {
  const values = columnValues(sync, f);
  if (f.title !== undefined) values.name = f.title;
  if (!Object.keys(values).length) return;
  await monday(
    token,
    'mutation ($board: ID!, $item: ID!, $values: JSON!) { change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }',
    { board: sync.board, item: itemId, values: JSON.stringify(values) },
  );
}

export async function createItem(token: string, sync: BoardSync, f: TaskFields & { title: string }) {
  const data = await monday<{ create_item: { id: string } }>(
    token,
    'mutation ($board: ID!, $name: String!, $values: JSON) { create_item(board_id: $board, item_name: $name, column_values: $values) { id } }',
    { board: sync.board, name: f.title, values: JSON.stringify(columnValues(sync, f)) },
  );
  return data.create_item.id;
}
