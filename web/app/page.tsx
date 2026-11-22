export default function Home() {
  return (
    <main>
      <h1>Promise Keeper for Gmail</h1>
      <p className="muted">Most email tools read your inbox: what others ask of you. Promise Keeper also reads your Sent folder: what you promised others, and what others promised you. When a promise slips, it helps you follow up.</p>
      <h2>What it does</h2>
      <ul>
        <li>Finds promises, requests, hard deadlines and things you are waiting on, with the sentence that triggered each.</li>
        <li>Shows them in the Gmail sidebar. You press Accept, Edit or Dismiss. Nothing is added without your say-so.</li>
        <li>Accepted items go to Google Tasks (and deadlines to Google Calendar) with a link back to the email.</li>
        <li>A morning digest email, and one-tap follow-up drafts that you review before sending.</li>
      </ul>
      <p className="muted">This app is in testing and is not yet verified by Google. Read the <a href="/privacy">privacy policy</a> to see exactly what is accessed, sent and stored.</p>
    </main>
  );
}
