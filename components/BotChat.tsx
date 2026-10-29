'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_LENGTH } from '@/lib/bots';
import { useOffice } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import Portrait from './Portrait';

interface Line { role: 'user' | 'assistant'; content: string }

// A private chat with one bot. History comes straight from the database (you
// can only read your own); new messages go through /api/bots/[id]/chat, which
// streams the reply back.
export default function BotChat({ id }: { id: string }) {
  const bot = useOffice(s => s.coworkers.find(c => c.id === id));
  const workspace = useOffice(s => s.workspace);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!workspace) return;
    createClient()
      .from('bot_messages')
      .select('role, content')
      .eq('bot_id', id)
      .order('created_at')
      .limit(200)
      .then(({ data, error }) => {
        if (error) setNote('Could not load the conversation. Has the bots migration been run?');
        else setLines(data as Line[]);
      });
    input.current?.focus();
  }, [id, workspace]);

  // Keep the newest message in view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  if (!bot) return <p className="empty">This bot isn&apos;t here anymore.</p>;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setNote(null);
    setDraft('');
    setLines(l => [...l, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    const appendReply = (text: string) => setLines(l => {
      const copy = l.slice();
      copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + text };
      return copy;
    });

    try {
      const res = await fetch(`/api/bots/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setLines(l => l.slice(0, -2)); // take the unsent message back out
        setDraft(message);
        setNote(body.error ?? 'Could not reach the bot.');
        return;
      }
      const remaining = Number(res.headers.get('X-Messages-Left'));
      if (!Number.isNaN(remaining)) setLeft(remaining);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendReply(decoder.decode(value, { stream: true }));
      }
    } catch {
      appendReply('[The connection dropped. Try again.]');
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const clear = async () => {
    if (!window.confirm(`Clear your conversation with ${bot.name}? This can't be undone.`)) return;
    const { error } = await createClient().from('bot_messages').delete().eq('bot_id', id);
    if (error) setNote('Could not clear the conversation.');
    else setLines([]);
  };

  return (
    <div className="bot-chat">
      <header className="bot-head">
        <Portrait id={id} className="portrait mid" />
        <div>
          <strong>{bot.name}</strong>
          <span>{bot.role} · <span className="bot-badge">Bot</span></span>
        </div>
        {lines.length > 0 && <button className="mini-btn" onClick={clear} disabled={busy}>Clear chat</button>}
      </header>

      <div className="bot-log" ref={scroller}>
        <p className="bot-line assistant">{bot.greeting[0]}</p>
        {lines.map((l, i) => (
          <p key={i} className={`bot-line ${l.role}`}>
            {l.content || (busy && i === lines.length - 1 ? <span className="bot-typing">…</span> : null)}
          </p>
        ))}
      </div>

      {note && <p className="bot-note" role="status">{note}</p>}
      <form className="bot-input" onSubmit={send}>
        <textarea
          ref={input}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={`Message ${bot.name}… (Enter to send, Shift+Enter for a new line)`}
          aria-label={`Message ${bot.name}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button className="pixel-btn small" type="submit" disabled={busy || !draft.trim()}>{busy ? '…' : 'Send'}</button>
      </form>
      <p className="bot-meta">
        Powered by Claude. Only you can see this chat.{left !== null && ` ${left} message${left === 1 ? '' : 's'} left today.`}
      </p>
    </div>
  );
}
