import { ImageResponse } from 'next/og';

/** Stat-tile picture for the Gmail sidebar. Only four small counts come in via the query string; no names or text. */
export const runtime = 'nodejs';

const n = (v: string | null) => String(Math.min(999, Math.max(0, Math.floor(Number(v) || 0))));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const tiles = [
    { v: n(q.get('o')), l: 'Overdue', c: '#d93025' },
    { v: n(q.get('t')), l: 'Due today', c: '#e37400' },
    { v: n(q.get('r')), l: 'To review', c: '#1a73e8' },
    { v: n(q.get('w')), l: 'Waiting', c: '#188038' },
  ];
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff', padding: 8, gap: 10 }}>
        {tiles.map((t) => (
          <div key={t.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, background: '#f1f3f4', borderRadius: 24 }}>
            <div style={{ fontSize: 76, fontWeight: 700, color: t.c, lineHeight: 1 }}>{t.v}</div>
            <div style={{ fontSize: 26, color: '#5f6368', marginTop: 8 }}>{t.l}</div>
          </div>
        ))}
      </div>
    ),
    { width: 720, height: 190, headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
