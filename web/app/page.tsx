export default function Home() {
  const F = (icon: string, t: string, d: string) => <div className="feat"><img src={`/icons/${icon}.png`} alt="" /><b>{t}</b><span className="muted">{d}</span></div>;
  return (
    <main>
      <div className="hero">
        <img src="/logo.png" alt="" width={84} height={84} />
        <h1>Never lose a promise in your inbox</h1>
        <p className="muted">Most email tools read your inbox. Promise Keeper also reads your Sent folder: what you promised, what you were asked, and what others owe you. When a promise slips, it helps you follow up.</p>
        <p><a className="btn" href="/items">Open my promises</a> <a className="btn ghost" href="/settings">Sign in</a></p>
      </div>
      <div className="grid3">
        {F('promised', 'Finds every commitment', 'Promises, requests, deadlines and things you are waiting on, each with the sentence it came from.')}
        {F('tasks', 'Tasks and Calendar', 'Press Accept and it lands in Google Tasks, with deadlines on your Calendar. Nothing is added without you.')}
        {F('waiting', 'Follow-ups and digest', 'A designed morning digest, and one-tap follow-up drafts that you review before sending.')}
      </div>
      <p className="muted">This app is in testing and is not yet verified by Google. Read the <a href="/privacy">privacy policy</a> to see exactly what is accessed, sent and stored.</p>
    </main>
  );
}
