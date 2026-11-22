export const metadata = { title: 'Privacy policy · Promise Keeper' };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function Privacy() {
  return (
    <main>
      <h1>Privacy policy</h1>
      <p className="muted">Promise Keeper for Gmail. This page explains what the app accesses, sends and stores, and how you delete it.</p>

      <h2>What Promise Keeper accesses</h2>
      <p>When you sign in with Google and approve access, the app can:</p>
      <ul>
        <li><b>Read your Gmail messages</b> (Inbox and Sent) to find promises, requests and deadlines.</li>
        <li><b>Create Gmail drafts</b> (follow-up nudges). It never sends a draft for you.</li>
        <li><b>Create and update Google Tasks and Calendar events</b>, only after you press Accept.</li>
        <li><b>Run as a Gmail add-on</b> so its panel appears next to the email you have open.</li>
        <li>Read your basic profile (name and email address) to identify your account.</li>
      </ul>

      <h2>What is sent to the AI model</h2>
      <p>For each email, the cleaned message text (quoted replies, signatures and footers removed, at most about 3,000 characters), the sender and recipient names and addresses, the subject and the send date are sent to Google&apos;s Gemini API to extract commitments. Attachments are never sent. The paid Gemini API tier is used, where inputs are not used to improve Google&apos;s products.</p>

      <h2>What is stored</h2>
      <ul>
        <li>The extracted items: what, who, due date, confidence, and the one evidence sentence that triggered each.</li>
        <li>Your settings, your decisions (accept, edit, dismiss), and basic usage events such as digest opens.</li>
        <li>An encrypted Google refresh token (AES-256-GCM) so scanning can continue when you are away.</li>
        <li><b>Full email bodies are never stored.</b></li>
      </ul>

      <h2>Who processes your data</h2>
      <p>Google (Gmail, Tasks, Calendar and Gemini APIs), the hosting provider (Vercel), the database provider (Supabase) and, for the morning digest, an email delivery provider (Resend). Your data is not sold and is not used for advertising.</p>

      <h2>Google API Services User Data Policy</h2>
      <p>Promise Keeper&apos;s use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. Data from Gmail is used only to provide the user-facing features described here.</p>

      <h2>Deleting your data</h2>
      <p>You can delete everything, including the stored token, on the <a href="/data-deletion">data deletion page</a>. You can also revoke access at any time in your <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.</p>

      <h2>Contact</h2>
      <p>{contact ? <>Questions or requests: <a href={`mailto:${contact}`}>{contact}</a>.</> : 'Contact the developer who invited you to test Promise Keeper.'}</p>
    </main>
  );
}
