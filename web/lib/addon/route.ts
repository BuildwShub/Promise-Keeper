import { NextResponse } from 'next/server';
import { adminClient } from '../supabase';
import { authenticate, baseUrl, handleAddon, signInCard, type Kind } from './handler';
import { showCard } from './cards';

/** Shared POST handler for the three add-on endpoints. Google calls these with a signed token; anything else gets 401. */
export function addonRoute(kind: Kind) {
  return async function POST(req: Request) {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }
    const db = adminClient();
    const auth = await authenticate(req, body, db);
    if (!auth.ok) {
      if (auth.reason === 'no_account') return NextResponse.json(showCard(signInCard({ base: baseUrl() })));
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    try {
      return NextResponse.json(await handleAddon(kind, body, auth.user, db));
    } catch (e) {
      console.error('addon error', kind, (e as Error).message);
      return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
  };
}
