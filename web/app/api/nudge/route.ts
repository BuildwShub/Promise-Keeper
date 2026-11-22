import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminClient } from '@/lib/supabase';
import { createNudgeDraft } from '@/lib/nudge';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Dashboard "Draft follow-up": plain form POST (session cookie required). Creates a Gmail draft, never sends, then returns to /items with a notice. */
export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get('id') ?? '');
  const tab = ['open', 'done', 'dismissed'].includes(String(form.get('tab'))) ? String(form.get('tab')) : 'open';
  const back = (notice: string) => NextResponse.redirect(new URL(`/items?tab=${tab}&notice=${encodeURIComponent(notice)}`, req.url), 303);

  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.redirect(new URL('/settings', req.url), 303);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return back('Could not create the draft: bad item id');

  try {
    const r = await createNudgeDraft(adminClient(), uid, id);
    return back(r.usedFallback ? 'Draft created in Gmail (standard wording). Review it in Drafts before sending.' : 'Draft created in Gmail. Review it in Drafts before sending.');
  } catch (e) {
    return back('Could not create the draft: ' + String((e as Error).message ?? e).slice(0, 120));
  }
}
