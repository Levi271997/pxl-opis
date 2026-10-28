'use client';

import { useEffect, useMemo, useState } from 'react';
import { BOOKS, bookById, type Book } from '@/lib/books';
import type { CSSVars } from './TaskCard';

interface Para { text: string; verse: boolean }
interface Progress { page: number; pages: number }

const PAGE_CHARS = 1400;
const texts = new Map<string, string>(); // downloaded books, kept while the tab is open

// Gutenberg text is hard-wrapped at ~70 columns: join the lines of normal
// paragraphs, but keep the line breaks of poems, lists and contents pages.
function toParagraphs(text: string): Para[] {
  return text
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => {
      const lines = p.replace(/^\n+|\s+$/g, '').split('\n');
      const verse = lines.length > 1 && lines.every(l => l.trim().length < 55);
      return { text: verse ? lines.join('\n') : lines.map(l => l.trim()).join(' '), verse };
    });
}

function toPages(paras: Para[]): Para[][] {
  const pages: Para[][] = [];
  let page: Para[] = [];
  let size = 0;
  for (const p of paras) {
    if (page.length && size + p.text.length > PAGE_CHARS) {
      pages.push(page);
      page = [];
      size = 0;
    }
    page.push(p);
    size += p.text.length;
  }
  if (page.length) pages.push(page);
  return pages;
}

// Where you stopped reading, remembered in this browser only.
const progressKey = (id: string) => `pxl-opis:book:${id}`;
function loadProgress(id: string): Progress | null {
  try {
    return JSON.parse(localStorage.getItem(progressKey(id)) ?? 'null');
  } catch {
    return null;
  }
}
function saveProgress(id: string, progress: Progress) {
  try {
    localStorage.setItem(progressKey(id), JSON.stringify(progress));
  } catch {
    // Private windows can refuse storage; you just start from page 1 next time.
  }
}

function Reader({ book, onBack }: { book: Book; onBack: () => void }) {
  const [text, setText] = useState(() => texts.get(book.id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(() => loadProgress(book.id)?.page ?? 0);
  const pages = useMemo(() => (text ? toPages(toParagraphs(text)) : []), [text]);
  const last = Math.max(pages.length - 1, 0);
  const current = Math.min(page, last);

  useEffect(() => {
    if (text) return;
    let cancelled = false;
    fetch(`/api/books/${book.id}`)
      .then(async res => {
        if (!res.ok || !res.headers.get('content-type')?.startsWith('text/plain')) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Could not open the book. Try again later.');
        }
        return res.text();
      })
      .then(t => { texts.set(book.id, t); if (!cancelled) setText(t); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [book.id, text]);

  useEffect(() => {
    if (pages.length) saveProgress(book.id, { page: current, pages: pages.length });
  }, [book.id, current, pages.length]);

  // Left / right arrows turn the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage(p => Math.min(p + 1, last));
      if (e.key === 'ArrowLeft') setPage(p => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  return (
    <div className="reader">
      <div className="reader-head" style={{ '--c': book.color } as CSSVars}>
        <button className="mini-btn" onClick={onBack}>&lt; Shelf</button>
        <div>
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>
      </div>

      <div className="reader-page">
        {error ? <p className="empty">{error}</p>
          : !text ? <p className="empty">Taking the book off the shelf…</p>
          : pages[current].map((p, i) => <p key={i} className={p.verse ? 'verse' : undefined}>{p.text}</p>)}
      </div>

      {pages.length > 0 && (
        <div className="reader-nav">
          <button className="pixel-btn small" disabled={current === 0} onClick={() => setPage(current - 1)}>&lt; Prev</button>
          <span>Page {current + 1} of {pages.length}</span>
          <button className="pixel-btn small" disabled={current === last} onClick={() => setPage(current + 1)}>Next &gt;</button>
        </div>
      )}
    </div>
  );
}

export default function BookshelfPanel() {
  const [reading, setReading] = useState<string | null>(null);
  const book = reading ? bookById(reading) : undefined;
  if (book) return <Reader book={book} onBack={() => setReading(null)} />;

  return (
    <div className="bookshelf">
      <p className="fridge-note">Five free classics. Pick one and take a reading break.</p>
      <div className="books">
        {BOOKS.map(b => {
          const progress = loadProgress(b.id);
          return (
            <article key={b.id} className="book" style={{ '--c': b.color } as CSSVars}>
              <span className="book-spine" />
              <div className="book-info">
                <strong>{b.title}</strong>
                <span className="book-author">{b.author}</span>
                <span>{b.blurb}</span>
              </div>
              <button className="mini-btn" onClick={() => setReading(b.id)}>
                {progress && progress.page > 0 ? `Page ${progress.page + 1}` : 'Read'}
              </button>
            </article>
          );
        })}
      </div>
      <p className="fridge-tip">Public-domain texts from Project Gutenberg. Use the arrow keys to turn pages.</p>
    </div>
  );
}
