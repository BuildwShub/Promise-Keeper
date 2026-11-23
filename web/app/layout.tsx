import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import Link from 'next/link';
import Nav from '@/components/Nav';
import './globals.css';

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Promise Keeper',
  description: 'Tracks what you promised, what you were asked, and what others owe you, straight from Gmail.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <Nav />
        {children}
        <footer className="foot">Promise Keeper never sends email for you. <Link href="/privacy">Privacy</Link> · <Link href="/data-deletion">Delete my data</Link></footer>
      </body>
    </html>
  );
}
