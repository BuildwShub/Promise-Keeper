/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pure builders for Workspace add-on card JSON (HTTP endpoints). No I/O, so they are easy to test. */

export const TYPE_COLOR: Record<string, string> = { my_promise: '#4285F4', request_to_me: '#B06000', deadline: '#EA4335', waiting_on: '#34A853' };
export const TYPE_LABEL: Record<string, string> = { my_promise: 'I promised', request_to_me: 'Asked of me', deadline: 'Deadline', waiting_on: 'Waiting on them' };

export interface CardItem {
  id: string; type: string; what: string; due: string | null; due_text: string; needs_date: boolean; confidence: number;
  evidence: string; status: string; counterparty_name: string; task_id?: string | null; event_id?: string | null;
}
export interface Ctx { base: string; threadId?: string; msgId?: string }

const LOGO = (process.env.ADDON_BASE_URL || 'https://promise-keeper-omega.vercel.app').replace(/\/$/, '') + '/logo.png';
export const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const TYPE_ICON: Record<string, string> = { my_promise: 'promised', request_to_me: 'asked', deadline: 'deadline', waiting_on: 'waiting' };
const icon = (ctx: Ctx, name: string) => ({ iconUrl: `${ctx.base}/icons/${name}.png`, altText: name });
const fn = (ctx: Ctx, params: Record<string, string | undefined>) => ({
  function: `${ctx.base}/api/addon/action`,
  parameters: Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([key, value]) => ({ key, value: String(value) })),
});
const button = (ctx: Ctx, text: string, params: Record<string, string | undefined>, filled = false) => ({
  text, ...(filled ? { type: 'FILLED' } : {}), onClick: { action: fn(ctx, params) },
});
const linkButton = (text: string, url: string) => ({ text, onClick: { openLink: { url } } });

export const card = (title: string, sections: any[], subtitle?: string) => ({ header: { title, ...(subtitle ? { subtitle } : {}), imageUrl: `${LOGO}`, imageType: 'CIRCLE' }, sections });

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function bucketOf(due: string | null, today: string): 'overdue' | 'today' | 'week' | 'later' | 'none' {
  if (!due) return 'none';
  const d = Math.round((Date.parse(due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later';
}
const BUCKET_LABEL = { overdue: 'Overdue', today: 'Due today', week: 'This week', later: 'Later', none: 'No date' };
const BUCKET_COLOR = { overdue: '#EA4335', today: '#B06000', week: '#4285F4', later: '#5f6368', none: '#5f6368' };
/** "MON 23 NOV" in the bucket colour, plus the bucket name. */
export function dateLine(due: string | null, today: string, status: string): string {
  if (!due) return '<font color="#5f6368"><b>NO DATE</b></font>';
  const d = new Date(due + 'T00:00:00Z');
  const b = status === 'done' ? 'later' : bucketOf(due, today);
  return `<font color="${BUCKET_COLOR[b]}"><b>${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}</b> · ${BUCKET_LABEL[b]}</font>`;
}

function dueLine(it: CardItem, today: string): string {
  if (it.due) return `Due ${it.due}${it.status !== 'done' && it.due < today ? ' (overdue)' : ''}${it.due_text ? ` · "${esc(it.due_text)}"` : ''}`;
  return it.needs_date ? 'Needs a date' : 'No date';
}

/** One item with the buttons that fit its status. */
export function itemSection(it: CardItem, ctx: Ctx, today: string): any {
  const p = { id: it.id, threadId: ctx.threadId, msgId: ctx.msgId };
  const buttons: any[] = [];
  if (it.status === 'suggested') buttons.push(button(ctx, 'Accept', { ...p, op: 'accept' }, true));
  if (it.status === 'accepted') buttons.push(button(ctx, 'Done', { ...p, op: 'done' }, true));
  if (it.status === 'possibly_resolved') buttons.push(button(ctx, 'They delivered', { ...p, op: 'done' }, true));
  if (it.status !== 'dismissed' && it.status !== 'done') {
    buttons.push(button(ctx, 'Edit', { ...p, op: 'edit' }));
    if (it.type === 'waiting_on') buttons.push(button(ctx, 'Draft follow-up', { ...p, op: 'nudge' }));
    buttons.push(button(ctx, 'Dismiss', { ...p, op: 'dismiss' }));
  }
  const color = TYPE_COLOR[it.type] ?? '#5f6368';
  const widgets: any[] = [
    { textParagraph: { text: dateLine(it.due, today, it.status) } },
    { decoratedText: { startIcon: icon(ctx, TYPE_ICON[it.type] ?? 'suggested'), topLabel: `<font color="${color}"><b>${esc(TYPE_LABEL[it.type] ?? it.type)}</b></font>${it.status === 'accepted' ? ' · <font color="#34A853"><b>Accepted</b></font>' : it.confidence < 0.6 ? ' · low confidence' : ''}`, text: `<b>${esc(it.what)}</b>`, bottomLabel: it.counterparty_name ? esc(it.counterparty_name) : it.needs_date ? 'Needs a date' : undefined, wrapText: true } },
    { textParagraph: { text: `<i>"${esc(it.evidence)}"</i>` } },
  ];
  if (it.status === 'accepted') {
    widgets.push({ divider: {} });
    widgets.push({ decoratedText: { startIcon: icon(ctx, 'tasks'), topLabel: 'Google Tasks', text: it.task_id ? '<font color="#34A853"><b>Task created</b></font>' : 'Task pending', wrapText: true } });
    if (it.due) widgets.push({ decoratedText: { startIcon: icon(ctx, 'calendar'), topLabel: 'Google Calendar', text: it.event_id ? `<font color="#34A853"><b>Event on ${esc(it.due)}</b></font>` : 'No calendar event for this item', wrapText: true } });
  }
  if (buttons.length) widgets.push({ buttonList: { buttons } });
  return { widgets };
}

export function threadCard(items: CardItem[], ctx: Ctx, today: string): any {
  if (!items.length) {
    const widgets: any[] = [{ textParagraph: { text: 'No promises, requests or deadlines found in this conversation yet.' } }];
    if (ctx.msgId) widgets.push({ buttonList: { buttons: [button(ctx, 'Scan this email', { op: 'scan', threadId: ctx.threadId, msgId: ctx.msgId }, true)] } });
    return card('This conversation', [{ widgets }]);
  }
  return card(`${items.length} promise${items.length === 1 ? '' : 's'} found`, items.map((it) => itemSection(it, ctx, today)), 'In this conversation');
}

export function homeCard(stats: { open: number; overdue: number; waiting: number; suggested: number; today?: number }, top: CardItem[], ctx: Ctx, today: string): any {
  const banner = `${ctx.base}/api/addon/banner?o=${stats.overdue}&t=${stats.today ?? 0}&r=${stats.suggested}&w=${stats.waiting}`;
  const sections: any[] = [{ widgets: [{ image: { onClick: { openLink: { url: `${ctx.base}/items?tab=open` } }, imageUrl: banner, altText: `${stats.overdue} overdue, ${stats.today ?? 0} due today, ${stats.suggested} to review, ${stats.waiting} waiting` } }] }];
  if (stats.suggested) { const review = { openLink: { url: `${ctx.base}/items?tab=open&filter=review` } }; sections.push({ widgets: [{ decoratedText: { startIcon: icon(ctx, 'suggested'), text: `<b>${stats.suggested} suggestion${stats.suggested === 1 ? '' : 's'}</b> waiting for you`, bottomLabel: 'Tap to review them in the dashboard', wrapText: true, onClick: review, button: { text: 'Review', onClick: review } } }] }); }
  const order: ('overdue' | 'today' | 'week' | 'later')[] = ['overdue', 'today', 'week', 'later'];
  for (const k of order) {
    const g = top.filter((it) => bucketOf(it.due, today) === k);
    if (g.length) sections.push({ header: `${BUCKET_LABEL[k]} (${g.length})`, widgets: g.map((it) => ({ decoratedText: { startIcon: icon(ctx, TYPE_ICON[it.type] ?? 'suggested'), topLabel: dateLine(it.due, today, it.status), text: `<b>${esc(it.what)}</b>`, bottomLabel: it.counterparty_name ? esc(it.counterparty_name) : esc(TYPE_LABEL[it.type] ?? it.type), wrapText: true } })) });
  }
  if (!top.length)  sections.push({ widgets: [{ decoratedText: { startIcon: icon(ctx, 'done'), text: '<b>All clear</b>', bottomLabel: 'Open an email to see what it contains.', wrapText: true } }] });
  sections.push({ widgets: [{ buttonList: { buttons: [{ text: 'Open dashboard', type: 'FILLED', onClick: { openLink: { url: `${ctx.base}/items` } } }, linkButton('Metrics', `${ctx.base}/metrics`)] } }] });
  return { header: { title: 'Your promises', subtitle: 'Never lose a promise', imageUrl: `${ctx.base}/logo.png`, imageType: 'CIRCLE' }, sections };
}

export function editCard(it: CardItem, ctx: Ctx): any {
  const p = { id: it.id, threadId: ctx.threadId, msgId: ctx.msgId };
  return card('Edit item', [{
    widgets: [
      { textInput: { name: 'what', label: 'Text', value: it.what } },
      { selectionInput: { name: 'type', label: 'Type', type: 'DROPDOWN', items: Object.entries(TYPE_LABEL).map(([value, text]) => ({ text, value, selected: value === it.type })) } },
      { textInput: { name: 'due', label: 'Due date (YYYY-MM-DD, empty for none)', value: it.due ?? '' } },
      { textInput: { name: 'counterpartyName', label: 'With', value: it.counterparty_name } },
      { buttonList: { buttons: [button(ctx, 'Save', { ...p, op: 'save' }, true), button(ctx, 'Cancel', { ...p, op: 'cancel' })] } },
    ],
  }]);
}

export function messageCard(title: string, text: string, buttons: any[] = []): any {
  const widgets: any[] = [{ textParagraph: { text: esc(text) } }];
  if (buttons.length) widgets.push({ buttonList: { buttons } });
  return card(title, [{ widgets }]);
}

export const signInCard = (ctx: Ctx) => messageCard('Promise Keeper', 'Sign in to the Promise Keeper website once with this Google account to connect your mailbox.', [linkButton('Sign in', `${ctx.base}/settings`)]);

// ---- response wrappers ----
/** Homepage / contextual trigger: put the card on the stack. */
export const showCard = (c: any) => ({ action: { navigations: [{ pushCard: c }] } });
/** Button callback: replace the top card, optionally with a toast. */
export const replaceCard = (c: any, toast?: string) => ({ renderActions: { action: { navigations: [{ updateCard: c }], ...(toast ? { notification: { text: toast } } : {}) } } });
export const toastOnly = (text: string) => ({ renderActions: { action: { notification: { text } } } });
