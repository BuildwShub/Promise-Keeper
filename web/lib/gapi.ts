import { GoogleError } from './google';

/** Small JSON helper for the Tasks and Calendar REST APIs. Returns null for 404/410 (already gone) when `ignoreGone` is set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(token: string, method: string, url: string, body?: unknown, ignoreGone = false): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  if (ignoreGone && (res.status === 404 || res.status === 410)) return null;
  if (!res.ok) throw new GoogleError(res.status, `${method} ${new URL(url).pathname} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const T = 'https://tasks.googleapis.com/tasks/v1';
const C = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const TASKLIST_TITLE = 'Promise Keeper';

export const tasks = {
  listGet: (tok: string, id: string) => call(tok, 'GET', `${T}/users/@me/lists/${id}`, undefined, true),
  listAll: async (tok: string) => (await call(tok, 'GET', `${T}/users/@me/lists?maxResults=100`)).items ?? [],
  listInsert: (tok: string, title: string) => call(tok, 'POST', `${T}/users/@me/lists`, { title }),
  insert: (tok: string, listId: string, body: object) => call(tok, 'POST', `${T}/lists/${listId}/tasks`, body),
  patch: (tok: string, listId: string, id: string, body: object) => call(tok, 'PATCH', `${T}/lists/${listId}/tasks/${id}`, body, true),
  update: (tok: string, listId: string, id: string, body: object) => call(tok, 'PUT', `${T}/lists/${listId}/tasks/${id}`, body, true),
  remove: (tok: string, listId: string, id: string) => call(tok, 'DELETE', `${T}/lists/${listId}/tasks/${id}`, undefined, true),
  async listAllTasks(tok: string, listId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = [];
    let page: string | undefined;
    do {
      const q = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100' });
      if (page) q.set('pageToken', page);
      const r = await call(tok, 'GET', `${T}/lists/${listId}/tasks?${q}`);
      out.push(...(r.items ?? []));
      page = r.nextPageToken;
    } while (page);
    return out;
  },
};

export const calendar = {
  insert: (tok: string, body: object) => call(tok, 'POST', C, body),
  patch: (tok: string, id: string, body: object) => call(tok, 'PATCH', `${C}/${id}`, body, true),
  remove: (tok: string, id: string) => call(tok, 'DELETE', `${C}/${id}`, undefined, true),
};
