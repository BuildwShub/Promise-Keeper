import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Promise Keeper',
  description: 'Tracks what you promised, what you were asked, and what others owe you, straight from Gmail.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Promise Keeper</Link>
          <Link href="/items">Items</Link>
          <Link href="/metrics">Metrics</Link>
          <Link href="/admin/eval">Eval</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/data-deletion">Delete my data</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
