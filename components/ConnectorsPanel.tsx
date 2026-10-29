'use client';

import { useCallback, useEffect, useState } from 'react';
import { COMING_SOON, CONNECTORS, USE_LABELS, type ConnectorId } from '@/lib/connectors/catalog';
import { useOffice } from '@/lib/store';
import type { CSSVars } from './TaskCard';

interface Status {
  id: ConnectorId;
  configured: boolean;
  connection: { account: string; detail: string | null; connectedBy: string; connectedAt: string } | null;
}
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
        Connected tools are stored for the whole team, encrypted, and only the server can use them. Syncing tasks and
        bot access are being built next; connecting now gets you ready.
      </p>
    </div>
  );
}
