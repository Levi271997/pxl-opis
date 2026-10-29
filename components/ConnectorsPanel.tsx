'use client';

import { useCallback, useEffect, useState } from 'react';
import { COMING_SOON, CONNECTORS, USE_LABELS, type ConnectorId } from '@/lib/connectors/catalog';
import { useOffice } from '@/lib/store';
import { fetchBoard, syncConnectors, type Workspace } from '@/lib/supabase/office';
import type { CSSVars } from './TaskCard';

interface Status {
  id: ConnectorId;
  configured: boolean;
  connection: { account: string; detail: string | null; connectedBy: string; connectedAt: string; sync: SyncInfo | null } | null;
}
interface SyncInfo { boards: { id: string; name: string }[]; syncedAt: string | null; canWrite: boolean }
interface Board { id: string; name: string; workspace: string | null; items: number }
interface List { canManage: boolean; ready: boolean; connectors: Status[] }

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Settings > Connectors: connect outside tools to this office. Owner/admins
// manage them; everyone can see what's connected. Tokens never reach the browser.
export default function ConnectorsPanel() {
  const workspace = useOffice(s => s.workspace);
  const [list, setList] = useState<List | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<ConnectorId | null>(null);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    const res = await fetch(`/api/connectors?workspace=${workspace.id}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setNote(body.error ?? 'Could not load connectors.');
    else setList(body);
  }, [workspace]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!workspace) return <p className="empty">Sign in to connect your team&apos;s tools.</p>;
  if (!list) return <p className="empty">{note ?? 'Loading connectors…'}</p>;

  const disconnect = async (id: ConnectorId, name: string) => {
    if (!window.confirm(`Disconnect ${name}? The stored access is deleted. You can connect again any time.`)) return;
    setBusy(id);
    const res = await fetch(`/api/connectors/${id}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    setNote(res.ok ? `${name} was disconnected.` : body.error ?? 'Could not disconnect.');
    await refresh();
  };

  return (
    <div className="connectors">
      <p className="tm-help">
        Connect the tools your team already uses. Board sync brings their tasks into the office; bot tools let the
        Claude bots look things up in them. {!list.canManage && 'Only the owner or an admin can connect or disconnect tools.'}
      </p>
      {note && <p className="fridge-note" role="status">{note}</p>}
      {list.canManage && !list.ready && (
        <p className="bot-note">The server isn&apos;t ready for connectors yet: it needs SUPABASE_SECRET_KEY and CONNECTORS_SECRET. See docs/CONNECTORS.md.</p>
      )}

      <div className="connector-list">
        {CONNECTORS.map(c => {
          const status = list.connectors.find(s => s.id === c.id);
          const conn = status?.connection;
          return (
            <article key={c.id} className={`connector${conn ? ' connected' : ''}`} style={{ '--c': c.color } as CSSVars}>
              <span className="connector-logo" aria-hidden>{c.name[0]}</span>
              <div className="connector-info">
                <strong>{c.name}</strong>
                <span>{c.description}</span>
                <span className="connector-uses">
                  {c.uses.map(u => <span key={u} className="use-chip">{USE_LABELS[u]}</span>)}
                </span>
                {conn ? (
                  <span className="connector-status ok">
                    Connected as {conn.account}{conn.detail ? ` · ${conn.detail}` : ''} · by {conn.connectedBy}, {shortDate(conn.connectedAt)}
                  </span>
                ) : !status?.configured ? (
                  <span className="connector-status">Not set up on the server yet (see docs/CONNECTORS.md)</span>
                ) : null}
                {conn?.sync && (
                  <BoardSync workspace={workspace} sync={conn.sync} canManage={list.canManage} onChange={refresh} />
                )}
              </div>
              {list.canManage && (conn ? (
                <button className="mini-btn" disabled={busy === c.id} onClick={() => disconnect(c.id, c.name)}>Disconnect</button>
              ) : (
                <a
                  className={`pixel-btn small${status?.configured && list.ready ? '' : ' disabled'}`}
                  href={status?.configured && list.ready ? `/api/connectors/${c.id}/connect?workspace=${workspace.id}` : undefined}
                  aria-disabled={!(status?.configured && list.ready)}
                >
                  Connect
                </a>
              ))}
            </article>
          );
        })}
      </div>

      <h4 className="section-label">Coming soon</h4>
      <div className="coming-soon">
        {COMING_SOON.map(c => (
          <span key={c.name} className="soon-chip" style={{ '--c': c.color } as CSSVars}>{c.name}</span>
        ))}
      </div>
      <p className="tm-help">
        Connected tools are stored for the whole team, encrypted, and only the server can use them. Monday.com boards sync
        both ways; ClickUp and GitHub sync and bot access are being built next.
      </p>
    </div>
  );
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const syncedNote = (tasks = 0, boards = 0) => `Synced ${tasks} tasks from ${boards} board${boards === 1 ? '' : 's'}.`;

// Monday.com board sync: which boards come into the office, and Sync now.
function BoardSync({ workspace, sync, canManage, onChange }: {
  workspace: Workspace; sync: SyncInfo; canManage: boolean; onChange: () => Promise<void>;
}) {
  const [picking, setPicking] = useState<{ boards: Board[]; picked: Set<string>; max: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = async (message: string) => {
    useOffice.getState().loadBoard(await fetchBoard(workspace));
    setNote(message);
    await onChange();
  };

  const syncNow = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await syncConnectors(workspace, true);
      await reload(r.synced ? syncedNote(r.tasks, r.boards) : 'Nothing to sync yet: choose boards first.');
    } catch (err) {
      setNote((err as Error).message);
    }
    setBusy(false);
  };

  const choose = async () => {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/connectors/monday/boards?workspace=${workspace.id}`);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(body.error ?? 'Could not load your boards.');
    setPicking({ boards: body.boards, picked: new Set(body.picked), max: body.max });
  };

  const toggle = (id: string) => setPicking(p => {
    if (!p) return p;
    const picked = new Set(p.picked);
    if (picked.has(id)) picked.delete(id);
    else if (picked.size < p.max) picked.add(id);
    return { ...p, picked };
  });

  const save = async () => {
    if (!picking) return;
    setBusy(true);
    setNote(null);
    const res = await fetch('/api/connectors/monday/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        boards: picking.boards.filter(b => picking.picked.has(b.id)).map(b => ({ id: b.id, name: b.name })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setPicking(null);
      await reload(syncedNote(body.tasks, body.boards));
    } else {
      setNote(body.error ?? 'Could not save the boards.');
      await onChange();
    }
    setBusy(false);
  };

  return (
    <div className="board-sync">
      <span className="connector-status">
        {sync.boards.length
          ? <>Syncing {sync.boards.map(b => b.name).join(', ')}{sync.syncedAt && <> · last synced {ago(sync.syncedAt)}</>}</>
          : canManage ? 'Choose which boards to bring into the office.' : 'No boards picked yet. Ask an admin to choose some.'}
      </span>
      {!sync.canWrite && (
        <span className="bot-note">
          Changes made in the office can&apos;t go back to Monday.com yet: this connection was made read-only.
          {canManage && ' Disconnect and connect again to allow it.'}
        </span>
      )}
      {note && <span className="connector-status" role="status">{note}</span>}

      {picking ? (
        <div className="board-pick">
          {picking.boards.length === 0 && <span className="connector-status">No boards found in this Monday.com account.</span>}
          <div className="board-pick-list">
            {picking.boards.map(b => (
              <label key={b.id} className="board-pick-row">
                <input
                  type="checkbox"
                  checked={picking.picked.has(b.id)}
                  disabled={!picking.picked.has(b.id) && picking.picked.size >= picking.max}
                  onChange={() => toggle(b.id)}
                />
                <span>{b.name}</span>
                <small>{b.workspace ? `${b.workspace} · ` : ''}{b.items} items</small>
              </label>
            ))}
          </div>
          <span className="connector-status">Up to {picking.max} boards. Unticked boards leave the office (they stay in Monday.com).</span>
          <span className="board-sync-actions">
            <button className="pixel-btn small" disabled={busy} onClick={save}>{busy ? 'Syncing…' : 'Save and sync'}</button>
            <button className="mini-btn" disabled={busy} onClick={() => setPicking(null)}>Cancel</button>
          </span>
        </div>
      ) : (
        <span className="board-sync-actions">
          {canManage && <button className="mini-btn" disabled={busy} onClick={choose}>Choose boards</button>}
          {sync.boards.length > 0 && <button className="mini-btn" disabled={busy} onClick={syncNow}>{busy ? 'Syncing…' : 'Sync now'}</button>}
        </span>
      )}
    </div>
  );
}
