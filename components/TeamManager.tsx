'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOffice } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { canManageTeam, ROLE_LABELS, type MemberRole } from '@/lib/supabase/office';

interface Member { id: string; user_id: string | null; display_name: string; role: MemberRole }
interface Invite { id: string; token: string; email: string | null; role: 'admin' | 'member'; expires_at: string }

const inviteUrl = (token: string) => `${window.location.origin}/join/${token}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function RolePicker({ value, onChange }: { value: 'admin' | 'member'; onChange: (r: 'admin' | 'member') => void }) {
  return (
    <select aria-label="Role" value={value} onChange={e => onChange(e.target.value as 'admin' | 'member')}>
      <option value="member">Member</option>
      <option value="admin">Admin</option>
    </select>
  );
}

// Copies to the clipboard and says so on the button for a moment.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="mini-btn"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function TeamManager() {
  const workspace = useOffice(s => s.workspace);
  const admin = canManageTeam(workspace);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [linkRole, setLinkRole] = useState<'admin' | 'member'>('member');
  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState<'admin' | 'member'>('member');
  const [note, setNote] = useState<string | null>(null);
  const [changed, setChanged] = useState(false); // the office only re-reads the team on reload
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    const supabase = createClient();
    const [m, i] = await Promise.all([
      supabase.from('members').select('id, user_id, display_name, role').eq('workspace_id', workspace.id).order('created_at'),
      admin
        ? supabase.from('invites').select('id, token, email, role, expires_at')
          .eq('workspace_id', workspace.id).is('revoked_at', null).is('accepted_at', null)
          .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (m.error || i.error) setNote(`Could not load the team: ${(m.error ?? i.error)!.message}`);
    setMembers((m.data ?? []) as Member[]);
    setInvites((i.data ?? []) as Invite[]);
  }, [workspace, admin]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!workspace) return <p className="empty">Sign in to invite your real teammates.</p>;

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    setNote(error ? error.message : done);
    if (!error) setChanged(true);
    await refresh();
  };

  const supabase = createClient();
  const createLink = () => run(
    () => supabase.from('invites').insert({ workspace_id: workspace.id, role: linkRole }),
    'Invite link created. Copy it and send it to your teammates.',
  );
  const revoke = (inv: Invite) => run(
    () => supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', inv.id),
    'Invite cancelled. That link no longer works.',
  );
  const setRole = (m: Member, role: 'admin' | 'member') => run(
    () => supabase.from('members').update({ role }).eq('id', m.id),
    `${m.display_name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`,
  );
  const remove = (m: Member) => {
    if (!window.confirm(`Remove ${m.display_name} from the team? Their tasks stay but become unassigned.`)) return;
    run(() => supabase.from('members').delete().eq('id', m.id), `${m.display_name} was removed from the team.`);
  };
  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/invites/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: emailRole, workspaceId: workspace.id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(body.error ?? 'Could not send the invite.');
    setNote(body.sent ? `Invite sent to ${email}. They join as soon as they sign in.` : body.warning);
    setEmail('');
    await refresh();
  };

  const links = invites.filter(i => !i.email);
  const pendingEmails = invites.filter(i => i.email);

  return (
    <div className="team-manager">
      {note && <p className="fridge-note" role="status">{note}</p>}
      {changed && (
        <p className="tm-reload">
          The office updates when you reload. <button className="mini-btn" onClick={() => window.location.reload()}>Reload now</button>
        </p>
      )}

      <p className="tm-reload">
        Connect Monday.com, ClickUp or GitHub to this office.{' '}
        <button className="mini-btn" onClick={() => useOffice.getState().openModal({ kind: 'settings', tab: 'connectors' })}>Connectors</button>
      </p>

      <h4 className="section-label">Members ({members.length})</h4>
      <ul className="tm-list">
        {members.map(m => {
          const me = m.id === workspace.meId;
          const editable = admin && m.role !== 'owner';
          return (
            <li key={m.id}>
              <span className="tm-name">{m.display_name}{me ? ' (you)' : ''}</span>
              {editable && !me
                ? <RolePicker value={m.role as 'admin' | 'member'} onChange={r => setRole(m, r)} />
                : <span className={`tm-role role-${m.role}`}>{ROLE_LABELS[m.role]}</span>}
              {editable && !me && <button className="mini-btn" disabled={busy} onClick={() => remove(m)}>Remove</button>}
            </li>
          );
        })}
      </ul>

      {admin ? (
        <>
          <h4 className="section-label">Invite link</h4>
          <p className="tm-help">Anyone with the link can join until you cancel it or it expires (14 days).</p>
          <div className="tm-row">
            <span>Join as</span>
            <RolePicker value={linkRole} onChange={setLinkRole} />
            <button className="pixel-btn small" disabled={busy} onClick={createLink}>Create link</button>
          </div>
          {links.length > 0 && (
            <ul className="tm-list">
              {links.map(inv => (
                <li key={inv.id}>
                  <input className="tm-link" readOnly value={inviteUrl(inv.token)} onFocus={e => e.target.select()} aria-label="Invite link" />
                  <span className="tm-meta">{ROLE_LABELS[inv.role]} · until {shortDate(inv.expires_at)}</span>
                  <CopyButton text={inviteUrl(inv.token)} />
                  <button className="mini-btn" disabled={busy} onClick={() => revoke(inv)}>Cancel</button>
                </li>
              ))}
            </ul>
          )}

          <h4 className="section-label">Invite by email</h4>
          <form className="tm-row" onSubmit={sendEmail}>
            <input
              type="email" required placeholder="teammate@company.com" aria-label="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <RolePicker value={emailRole} onChange={setEmailRole} />
            <button className="pixel-btn small" type="submit" disabled={busy}>Send invite</button>
          </form>
          {pendingEmails.length > 0 && (
            <ul className="tm-list">
              {pendingEmails.map(inv => (
                <li key={inv.id}>
                  <span className="tm-name">{inv.email}</span>
                  <span className="tm-meta">{ROLE_LABELS[inv.role]} · waiting · until {shortDate(inv.expires_at)}</span>
                  <button className="mini-btn" disabled={busy} onClick={() => revoke(inv)}>Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="tm-help">Only the owner or an admin can invite people or change the team.</p>
      )}
    </div>
  );
}
