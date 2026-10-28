// Public-domain books on the office bookshelves. The text is fetched from
// Project Gutenberg by app/api/books/[id]/route.ts.

export interface Book {
  id: string;
  gutenbergId: number;
  title: string;
  author: string;
  blurb: string;
  color: string; // spine colour
}

export const BOOKS: Book[] = [
  {
    id: 'art-of-war', gutenbergId: 132, title: 'The Art of War', author: 'Sun Tzu',
    blurb: 'Strategy, planning and knowing when not to fight. Handy before sprint planning.', color: '#c0392b',
  },
  {
    id: 'meditations', gutenbergId: 2680, title: 'Meditations', author: 'Marcus Aurelius',
    blurb: "A Roman emperor's notes to himself on staying calm when everything is on fire.", color: '#7d5ba6',
  },
  {
    id: 'as-a-man-thinketh', gutenbergId: 4507, title: 'As a Man Thinketh', author: 'James Allen',
    blurb: 'A short classic on habits and mindset. Readable in one lunch break.', color: '#2f9e6e',
  },
  {
    id: 'alice', gutenbergId: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll',
    blurb: 'For when the requirements change mid-meeting and nothing makes sense.', color: '#4f7fe0',
  },
  {
    id: 'sherlock-holmes', gutenbergId: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle',
    blurb: 'Twelve cases. Good practice for debugging.', color: '#d97a12',
  },
];

export const bookById = (id: string) => BOOKS.find(b => b.id === id);
