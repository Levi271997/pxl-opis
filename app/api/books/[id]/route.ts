// The text of one bookshelf book, fetched from Project Gutenberg and cached for
// a month. Only the books listed in lib/books.ts can be requested.

import { NextResponse, type NextRequest } from 'next/server';
import { bookById } from '@/lib/books';

const MONTH = 60 * 60 * 24 * 30;

// Keep just the book: drop Gutenberg's header and license footer.
function bookText(raw: string) {
  const text = raw.replace(/\r\n/g, '\n');
  const start = text.search(/^\*\*\* ?START OF .*\*\*\*$/m);
  const end = text.search(/^\*\*\* ?END OF .*\*\*\*$/m);
  const body = text.slice(start >= 0 ? text.indexOf('\n', start) + 1 : 0, end >= 0 ? end : undefined);
  return body.trim();
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const book = bookById((await params).id);
  if (!book) return NextResponse.json({ error: 'No such book' }, { status: 404 });

  const n = book.gutenbergId;
  const res = await fetch(`https://www.gutenberg.org/cache/epub/${n}/pg${n}.txt`, { next: { revalidate: MONTH } });
  if (!res.ok) return NextResponse.json({ error: 'The library is closed right now. Try again later.' }, { status: 502 });

  return new NextResponse(bookText(await res.text()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': `public, max-age=${MONTH}` },
  });
}
