/** Send one email through Resend. Throws with Resend's message on failure. */
export async function sendEmail(m: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.DIGEST_FROM || 'Promise Keeper <onboarding@resend.dev>', to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) throw new Error('Resend: ' + (data.message ?? res.status));
  return { id: data.id };
}
