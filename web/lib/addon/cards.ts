/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pure builders for Workspace add-on card JSON (HTTP endpoints). No I/O, so they are easy to test. */

export const TYPE_LABEL: Record<string, string> = { my_promise: 'I promised', request_to_me: 'Asked of me', deadline: 'Deadline', waiting_on: 'Waiting on them' };

export interface CardItem {
  id: string; type: string; what: string; due: string | null; due_text: string; needs_date: boolean; confidence: number;
  evidence: string; status: string; counterparty_name: string;
}
export interface Ctx { base: string; threadId?: string; msgId?: string }

export const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fn = (ctx: Ctx, params: Record<string, string | undefined>) => ({
  function: `${ctx.base}/api/addon/action`,
  parameters: Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([key, value]) => ({ key, value: String(value) })),
});
const button = (ctx: Ctx, text: string, params: Record<string, string | undefined>, filled = false) => ({
  text, ...(filled ? { type: 'FILLED' } : {}), onClick: { action: fn(ctx, params) },
});
const linkButton = (text: string, url: string) => ({ text, onClick: { openLink: { url } } });

export const card = (title: string, sections: any[], subtitle?: string) => ({ header: { title, ...(subtitle ? { subtitle } : {}) }, sections });

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
    buttons.push(button(ctx, 'Dismiss', { ...p, op: 'dismiss' }));
  }
  const widgets: any[] = [
    { decoratedText: { topLabel: `${TYPE_LABEL[it.type] ?? it.type} · ${it.status.replace('_', ' ')}${it.confidence < 0.6 ? ' · suggestion' : ''}`, text: `<b>${esc(it.what)}</b>${it.counterparty_name ? ` (${esc(it.counterparty_name)})` : ''}`, bottomLabel: dueLine(it, today), wrapText: true } },
    { textParagraph: { text: `<i>"${esc(it.evidence)}"</i>` } },
  ];
  if (buttons.length) widgets.push({ buttonList: { buttons } });
  return { widgets };
}

export function threadCard(items: CardItem[], ctx: Ctx, today: string): any {
  if (!items.length) {
    const widgets: any[] = [{ textParagraph: { text: 'No promises, requests or deadlines found in this conversation yet.' } }];
    if (ctx.msgId) widgets.push({ buttonList: { buttons: [button(ctx, 'Scan this email', { op: 'scan', threadId: ctx.threadId, msgId: ctx.msgId }, true)] } });
    return card('Promise Keeper', [{ widgets }], 'This conversation');
  }
  return card('Promise Keeper', items.map((it) => itemSection(it, ctx, today)), `${items.length} item${items.length === 1 ? '' : 's'} in this conversation`);
}

export function homeCard(stats: { open: number; overdue: number; waiting: number; suggested: number }, top: CardItem[], ctx: Ctx, today: string): any {
  const sections: any[] = [{
    widgets: [
      { decoratedText: { topLabel: 'Open items', text: `<b>${stats.open}</b>`, bottomLabel: `${stats.suggested} to review · ${stats.overdue} overdue · ${stats.waiting} waiting on others`, wrapText: true } },
      { buttonList: { buttons: [linkButton('Open dashboard', `${ctx.base}/items`), linkButton('Metrics', `${ctx.base}/metrics`)] } },
    ],
  }];
  if (top.length) sections.push({ header: 'Most urgent', widgets: top.map((it) => ({ decoratedText: { topLabel: TYPE_LABEL[it.type] ?? it.type, text: esc(it.what), bottomLabel: dueLine(it, today), wrapText: true } })) });
  else sections.push({ widgets: [{ textParagraph: { text: 'Nothing open. Open an email to see what it contains.' } }] });
  return card('Promise Keeper', sections, 'Home');
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
