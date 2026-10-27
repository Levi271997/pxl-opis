import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });
const retro = VT323({ weight: '400', subsets: ['latin'], variable: '--font-retro' });

export const metadata: Metadata = {
  title: 'Pxl Opis',
  description: 'Project management, but you walk to your desk.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${retro.variable}`}>
      <body>{children}</body>
    </html>
  );
}
