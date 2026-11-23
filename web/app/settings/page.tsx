import { revalidatePath } from 'next/cache';
import { auth, signIn, signOut } from '@/auth';
import { adminClient, userClient } from '@/lib/supabase';
import { deleteUserData } from '@/lib/users';

export const metadata = { title: 'Settings · Promise Keeper' };
export const dynamic = 'force-dynamic';

const TIMEZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];

async function signInAction() {
  'use server';
  await signIn('google', { redirectTo: '/settings' });
}

async function signOutAction() {
  'use server';
  await signOut({ redirectTo: '/' });
}

async function saveSettings(form: FormData) {
  'use server';
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return;
  const tz = String(form.get('timezone') ?? '');
  const hour = Number(form.get('digest_hour'));
  const patch = {
    timezone: TIMEZONES.includes(tz) ? tz : 'Asia/Kolkata',
    digest_hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8,
    auto_add_enabled: form.get('auto_add_enabled') === 'on',
    share_metrics: form.get('share_metrics') === 'on',
  };
  // Acts as the user: row-level security enforces that only their own row can change.
  const { error } = await userClient(uid).from('users').update(patch).eq('id', uid);
  if (error) throw new Error('Could not save settings: ' + error.message);
  revalidatePath('/settings');
}

async function deleteAction(form: FormData) {
  'use server';
  if (String(form.get('confirm') ?? '').trim() !== 'DELETE') return;
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return;
  await deleteUserData(adminClient(), uid);
  await signOut({ redirectTo: '/data-deletion?deleted=1' });
}

export default async function Settings() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;

  if (!uid) {
    return (
      <main>
        <h1>Settings</h1>
        <p className="muted">Sign in with Google to manage Promise Keeper.</p>
        <form action={signInAction}>
          <button type="submit" className="primary">Sign in with Google</button>
        </form>
      </main>
    );
  }

  const { data: me, error } = await userClient(uid)
    .from('users')
    .select('email,name,timezone,digest_hour,auto_add_enabled,share_metrics')
    .eq('id', uid)
    .single();

  if (error || !me) {
    return (
      <main>
        <h1>Settings</h1>
        <p>Your account record was not found. It may have been deleted. Sign out and sign in again.</p>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Settings</h1>
      <p className="muted">Signed in as {me.email}.</p>

      <h2>Preferences</h2>
      <form action={saveSettings}>
        <p>
          <label>Timezone <select name="timezone" defaultValue={me.timezone}>
            {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select></label>
        </p>
        <p>
          <label>Morning digest hour (0 to 23) <input type="number" name="digest_hour" min={0} max={23} defaultValue={me.digest_hour} /></label>
        </p>
        <p>
          <label><input type="checkbox" name="auto_add_enabled" defaultChecked={me.auto_add_enabled} /> Auto-add high-confidence items (off by default)</label>
        </p>
        <p>
          <label><input type="checkbox" name="share_metrics" defaultChecked={me.share_metrics} /> Share anonymous usage metrics</label>
        </p>
        <button type="submit" className="primary">Save</button>
      </form>

      <h2>Session</h2>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h2>Delete my data</h2>
      <p>This removes your items, decisions, settings, events, processed-message list, stored Google token and account record. Tasks and Calendar entries you accepted stay in your Google account. It cannot be undone.</p>
      <form action={deleteAction}>
        <p>
          <label>Type <b>DELETE</b> to confirm <input type="text" name="confirm" autoComplete="off" /></label>
        </p>
        <button type="submit">Delete my data</button>
      </form>
    </main>
  );
}
