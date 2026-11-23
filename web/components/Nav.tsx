'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [['/items', 'Items'], ['/metrics', 'Metrics'], ['/admin/eval', 'Eval'], ['/settings', 'Settings'], ['/privacy', 'Privacy']];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="appbar">
      <Link href="/" className="brand"><img src="/logo.png" alt="" width={32} height={32} /><span className="wm">{[...'Promise'].map((c, i) => <b key={i} style={{ color: ['#4285F4', '#EA4335', '#FBBC04', '#4285F4', '#34A853', '#EA4335', '#34A853'][i] }}>{c}</b>)} <span className="keeper">Keeper</span></span></Link>
      <nav>
        {LINKS.map(([href, label]) => <Link key={href} href={href} className={path.startsWith(href) ? 'on' : ''}>{label}</Link>)}
      </nav>
    </header>
  );
}
