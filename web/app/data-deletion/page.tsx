export const metadata = { title: 'Delete my data · Promise Keeper' };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function DataDeletion({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main>
      <h1>Delete my data</h1>
      {deleted === '1' && <p><b>Your data has been deleted and you are signed out.</b></p>}
      <p className="muted">You can remove all of your Promise Keeper data at any time.</p>

      <h2>What deletion removes</h2>
      <ul>
        <li>Your extracted items, decisions, settings and usage events.</li>
        <li>The list of messages already processed.</li>
        <li>Your stored (encrypted) Google refresh token, so the app can no longer reach your Gmail.</li>
        <li>Your account record. Deletions are logged with a one-way hash of your id only, never your email address.</li>
      </ul>
      <p>Google Tasks and Calendar entries you accepted stay in your Google account. Delete them there if you want them gone.</p>

      <h2>How to delete</h2>
      <ol>
        <li>Sign in, open <a href="/settings">Settings</a> and choose <b>Delete my data</b>.</li>
        <li>Or revoke access in your <a href="https://myaccount.google.com/permissions">Google Account permissions</a> and then email the contact below asking for deletion.</li>
      </ol>
      <p>{contact ? <>Contact: <a href={`mailto:${contact}`}>{contact}</a>.</> : 'Contact the developer who invited you to test Promise Keeper.'}</p>
    </main>
  );
}
