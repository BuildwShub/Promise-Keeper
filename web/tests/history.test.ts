import { wantedFromHistory } from '../lib/google';

const added = (id: string, labelIds?: string[]) => ({ messagesAdded: [{ message: { id, labelIds } }] });

describe('wantedFromHistory', () => {
  test('keeps inbox and sent mail', () => {
    expect(wantedFromHistory([added('a', ['INBOX', 'UNREAD']), added('b', ['SENT'])])).toEqual(['a', 'b']);
  });
  test('drops promotions, social, spam, trash, drafts and chats', () => {
    const h = [
      added('promo', ['INBOX', 'CATEGORY_PROMOTIONS']), added('social', ['INBOX', 'CATEGORY_SOCIAL']),
      added('spam', ['SPAM']), added('trash', ['TRASH']), added('draft', ['DRAFT']), added('chat', ['CHAT', 'INBOX']),
    ];
    expect(wantedFromHistory(h)).toEqual([]);
  });
  test('keeps updates and forums like the sweep query does', () => {
    expect(wantedFromHistory([added('u', ['INBOX', 'CATEGORY_UPDATES']), added('f', ['INBOX', 'CATEGORY_FORUMS'])])).toEqual(['u', 'f']);
  });
  test('ignores entries without an id or without labels', () => {
    expect(wantedFromHistory([{ messagesAdded: [{ message: {} }] }, added('x'), { labelsAdded: [] }])).toEqual([]);
  });
});
