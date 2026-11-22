const Clean = require('../shared/clean.js');
const f = require('./fixtures/emails.js');

describe('Clean.clean', () => {
  test('cuts quoted reply', () => expect(Clean.clean(f.quotedReply)).toBe("I'll send the deck by Friday."));
  test('cuts line-wrapped "On ... wrote:"', () => expect(Clean.clean(f.wrappedQuote)).toBe('Sure, will share the report.'));
  test('cuts Outlook header block', () => expect(Clean.clean(f.outlookQuote)).toBe('Please review by EOD.'));
  test('cuts Original Message', () => expect(Clean.clean(f.originalMessage)).toBe('Fee due 20 Nov.'));
  test('removes sign-off + name', () => expect(Clean.clean(f.signature)).toBe("I'll send the deck by Friday."));
  test('removes "-- " signature', () => expect(Clean.clean(f.dashSignature)).toBe('Will update by Monday.'));
  test('removes Sent from my iPhone', () => expect(Clean.clean(f.iphone)).toBe('Done, sending tomorrow.'));
  test('removes footer', () => expect(Clean.clean(f.footer)).toBe('Your fee is due 20 Nov.'));
  test('keeps Hinglish intact', () => expect(Clean.clean(f.hinglish)).toBe(f.hinglish));
  test('inline "Thanks, noted" is not a sign-off', () => expect(Clean.clean(f.midThanks)).toContain('invoice on Monday'));
  test('truncates to max chars', () => expect(Clean.clean('word '.repeat(2000)).length).toBeLessThanOrEqual(3000));
  test('collapses whitespace', () => expect(Clean.clean('a   b\r\n\r\n\r\n\r\nc')).toBe('a b\n\nc'));
  test('handles empty/null', () => { expect(Clean.clean('')).toBe(''); expect(Clean.clean(null)).toBe(''); });
});

describe('Clean.htmlToText', () => {
  test('strips HTML and conditional comments', () => {
    expect(Clean.htmlToText('Hi<!--[if !mso]><!-->there<!--<![endif]-->').replace(/\s+/g, ' ').trim()).toBe('Hi there');
  });
  test('strips tags, quotes, styles; decodes entities', () => {
    const t = Clean.htmlToText(f.html);
    expect(t).toContain("I'll send it by Friday & confirm.");
    expect(t).not.toContain('old quoted');
    expect(t).not.toContain('p{}');
  });
});
