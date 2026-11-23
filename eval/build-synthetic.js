/**
 * Builds eval/synthetic-eval.json: ~75 invented emails with hand-worked expected answers.
 * The expected due dates come from the date rules in the prompt (weekday after the sent day, EOW = Friday, "next Tuesday" = the
 * following Monday-to-Sunday week, nearest day-of-month, ...), computed here, NOT taken from any model output.
 *   node eval/build-synthetic.js
 * Synthetic means invented by the developer: cleaner and shorter than real mail, so expect easier numbers than the real set.
 */
const fs = require('fs');
const path = require('path');
const Dates = require('../shared/dates.js');

const ME = 'alex.morgan@example.com';
const iso = (d) => `${d}T10:30:00+05:30`;
const monIdx = (d) => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const after = (sent, name) => { for (let i = 1; i <= 7; i++) { const x = Dates.addDays(sent, i); if (Dates.weekdayName(x) === name) return x; } };
const nextWeek = (sent, name) => Dates.addDays(sent, 7 - monIdx(sent) + WD.indexOf(name)); // the following Monday-to-Sunday week
const eow = (sent) => Dates.addDays(sent, 4 - monIdx(sent)); // Friday of the sent week
const dom = (sent, day) => { const [y, m, d] = sent.split('-').map(Number); const mm = day >= d ? m : m + 1; return `${mm > 12 ? y + 1 : y}-${String(mm > 12 ? 1 : mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };

const MON = '2026-11-16', TUE = '2026-11-17', WED = '2026-11-18', THU = '2026-11-19', FRI = '2026-11-20';
const cases = [];
let n = 0;
const add = (direction, sent, from, to, subject, body, expected, tags) => {
  n++;
  cases.push({ id: 'syn-' + String(n).padStart(3, '0'), direction, sentIso: iso(sent), from, to, subject, body, expected, tags });
};
const sentTo = (name, email) => `${name} <${email}>`;
const OWN = `Alex Morgan <${ME}>`;
const sig = '\n\nThanks,\nAlex';

// ---------- my_promise (sent) ----------
const P = (sent, who, subj, text, what, due, tags = ['my_promise']) => add('sent', sent, OWN, sentTo(who, who.toLowerCase() + '@example.com'), subj, `Hi ${who},\n\n${text}${sig}`, [{ type: 'my_promise', what, due }], tags);
P(THU, 'Neha', 'Vendor contract', "I'll send the vendor contract by Friday.", 'Send vendor contract', after(THU, 'Friday'));
P(MON, 'Rohan', 'Slides', 'Thanks Rohan. I will share the slide deck tomorrow.', 'Share slide deck', Dates.addDays(MON, 1));
P(WED, 'Kavya', 'Audit', "I'll have the audit summary ready by end of week.", 'Prepare audit summary', eow(WED), ['my_promise', 'date_relative']);
P(TUE, 'Imran', 'Quote', 'Will send the revised quote in 3 days.', 'Send revised quote', Dates.addDays(TUE, 3), ['my_promise', 'date_relative']);
P(THU, 'Dev', 'Venue', "I'll book the venue by the 25th.", 'Book venue', dom(THU, 25), ['my_promise', 'date_absolute']);
P(FRI, 'Sara', 'Invoice', "Sure, I'll send you the invoice next Tuesday.", 'Send invoice', nextWeek(FRI, 'Tuesday'), ['my_promise', 'date_relative']);
P(MON, 'Omar', 'Report', "I'll finish the report by EOD.", 'Finish report', MON, ['my_promise', 'date_relative']);
P(TUE, 'Lena', 'Photos', "I'll send you the photos tonight.", 'Send photos', TUE, ['my_promise', 'date_relative']);
P(WED, 'Tariq', 'Budget numbers', "I'll get you the budget numbers sometime next week.", 'Send budget numbers', '', ['my_promise', 'date_vague']);
P(THU, 'Mei', 'Expense claim', "I'll submit the expense claim on 3 Dec.", 'Submit expense claim', '2026-12-03', ['my_promise', 'date_absolute']);
P(FRI, 'Jon', 'Contract draft', 'I promise to send the contract draft on Monday.', 'Send contract draft', after(FRI, 'Monday'));
P(TUE, 'Asha', 'Supplier call', "I'll call the supplier and send you a summary by Thursday.", 'Send supplier call summary', after(TUE, 'Thursday'));

// ---------- request_to_me (inbox) ----------
const R = (sent, who, subj, text, what, due, tags = ['has_request']) => add('inbox', sent, sentTo(who, who.toLowerCase() + '@example.com'), OWN, subj, `Hi Alex,\n\n${text}\n\nRegards,\n${who}`, [{ type: 'request_to_me', what, due }], tags);
R(THU, 'Maya', 'Proposal', 'Can you review the proposal by EOD?', 'Review proposal', THU, ['has_request', 'date_relative']);
R(MON, 'Victor', 'NDA', 'Please send the signed NDA by Wednesday.', 'Send signed NDA', after(MON, 'Wednesday'));
R(TUE, 'Hana', 'Travel', 'Could you approve the travel request before Friday?', 'Approve travel request', after(TUE, 'Friday'));
R(WED, 'Ben', 'Onboarding', 'Please share the onboarding checklist soon.', 'Share onboarding checklist', '', ['has_request', 'date_vague']);
R(FRI, 'Ria', 'Forecast', 'I need the Q4 forecast from you by Monday, thanks.', 'Send Q4 forecast', after(FRI, 'Monday'));
R(THU, 'Sam', 'Pricing', 'Could you update the pricing sheet tomorrow?', 'Update pricing sheet', Dates.addDays(THU, 1), ['has_request', 'date_relative']);
add('inbox', WED, 'StreamFlix Billing <billing@streamflix.example>', OWN, 'Payment declined', 'We could not process your latest payment. Please update your payment method to keep your membership active.', [{ type: 'request_to_me', what: 'Update payment method', due: '' }], ['automated', 'has_request']);
add('inbox', MON, 'TaxPortal <no-reply@taxportal.example>', OWN, 'Action required', 'Action required: update your tax information in your account settings so we can apply the correct rates.', [{ type: 'request_to_me', what: 'Update tax information', due: '' }], ['automated', 'has_request']);
R(MON, 'Priyanka', 'Feedback', 'Please fill in the feedback form by the 18th.', 'Fill feedback form', dom(MON, 18), ['has_request', 'date_absolute']);
R(TUE, 'Leo', 'Headcount', 'Can you confirm the headcount by Thursday?', 'Confirm headcount', after(TUE, 'Thursday'));

// ---------- deadline (inbox) ----------
const DL = (sent, from, subj, text, what, due) => add('inbox', sent, from, OWN, subj, text, [{ type: 'deadline', what, due }], ['has_deadline', 'date_absolute']);
DL(WED, 'SafeLife Insurance <billing@safelife.example>', 'Premium reminder', 'Reminder: your annual insurance premium is due 28 Nov.', 'Pay insurance premium', '2026-11-28');
DL(MON, 'Revenue Dept <noreply@revenue.example>', 'Tax declaration', 'Your tax declaration must be submitted before the 30th.', 'Submit tax declaration', dom(MON, 30));
DL(THU, 'City Library <desk@library.example>', 'Overdue fine', 'Your library fine of Rs 200 must be paid by 30 Nov to avoid suspension of your membership.', 'Pay library fine', '2026-11-30');
DL(TUE, 'Passport Office <help@passport.example>', 'Documents', 'Your passport renewal documents are due by 2 Dec.', 'Submit passport renewal documents', '2026-12-02');
DL(FRI, 'HostRight <billing@hostright.example>', 'Domain renewal', 'Your domain renewal is due 5 Dec. Please renew to keep your site online.', 'Renew domain', '2026-12-05');
DL(WED, 'Exam Cell <exams@college.example>', 'Registration', 'Exam registration closes on 25 Nov. You must register to appear in the exam.', 'Complete exam registration', '2026-11-25');

// ---------- waiting_on ----------
const W = (direction, sent, who, subj, text, what, due, tags = ['has_waiting']) => {
  const from = direction === 'inbox' ? sentTo(who, who.toLowerCase() + '@example.com') : OWN;
  const to = direction === 'inbox' ? OWN : sentTo(who, who.toLowerCase() + '@example.com');
  add(direction, sent, from, to, subj, `Hi${direction === 'sent' ? ' ' + who : ' Alex'},\n\n${text}${direction === 'sent' ? sig : '\n\nBest,\n' + who}`, [{ type: 'waiting_on', what, due }], tags);
};
W('inbox', THU, 'Priya', 'Figures', 'Priya will send the final figures on Monday.', 'Send final figures', after(THU, 'Monday'));
W('sent', MON, 'Gita', 'Invoice', 'Can you send me the invoice by Wednesday?', 'Send invoice', after(MON, 'Wednesday'));
W('inbox', TUE, 'Joel', 'Order', "Our vendor confirmed they'll ship the order by next Friday.", 'Ship order', nextWeek(TUE, 'Friday'), ['has_waiting', 'date_relative']);
W('sent', WED, 'Nadia', 'Contract', 'Could you share the draft contract by Friday?', 'Share draft contract', after(WED, 'Friday'));
W('inbox', FRI, 'Sam', 'Quote', "Sam said he'd get back to us with the quote early next week.", 'Send quote', '', ['has_waiting', 'date_vague']);
W('sent', THU, 'Zoe', 'Signed form', 'Please send me the signed form as soon as possible.', 'Send signed form', '', ['has_waiting', 'date_vague']);
W('inbox', MON, 'Dev', 'Fix', 'The dev team will deploy the fix tomorrow.', 'Deploy fix', Dates.addDays(MON, 1), ['has_waiting', 'date_relative']);
W('sent', TUE, 'Ira', 'Photos', 'Could you send over the photos by tomorrow?', 'Send photos', Dates.addDays(TUE, 1), ['has_waiting', 'date_relative']);
W('inbox', WED, 'Finance', 'Payment', 'Finance will release the payment on the 24th.', 'Release payment', dom(WED, 24), ['has_waiting', 'date_absolute']);
W('sent', THU, 'Kabir', 'Booking', 'Can you confirm the booking in 2 days?', 'Confirm booking', Dates.addDays(THU, 2), ['has_waiting', 'date_relative']);

// ---------- Hinglish ----------
const H = (direction, sent, subj, text, type, what, due) => add(direction, sent, direction === 'sent' ? OWN : sentTo('Rahul', 'rahul@example.com'), direction === 'sent' ? sentTo('Rahul', 'rahul@example.com') : OWN, subj, `Hi,\n\n${text}\n\nThanks`, type ? [{ type, what, due }] : [], ['hinglish']);
H('sent', THU, 'Item', 'Theek hai, parso tak bhej dunga.', 'my_promise', 'Send requested item', Dates.addDays(THU, 2));
H('sent', MON, 'Update', 'Kal tak update de dunga.', 'my_promise', 'Send update', Dates.addDays(MON, 1));
H('inbox', TUE, 'Form', 'Kal tak form bhej dena please.', 'request_to_me', 'Send form', Dates.addDays(TUE, 1));
H('inbox', WED, 'Report', 'Aaj shaam tak report bhej dena.', 'request_to_me', 'Send report', WED);
H('sent', THU, 'Invoice', 'Agle hafte invoice bhej dunga.', 'my_promise', 'Send invoice', '');
H('sent', FRI, 'Design', 'Bilkul, Monday tak design bhej dunga.', 'my_promise', 'Send design', after(FRI, 'Monday'));
H('inbox', MON, 'Files', 'Rahul kal tak files bhej dega.', 'waiting_on', 'Send files', Dates.addDays(MON, 1));
H('sent', TUE, 'Check', 'Haan, main dekh leta hoon.', null);
H('sent', WED, 'Later', 'Thik hai, baad mein baat karte hain.', null);

// ---------- several items in one email ----------
add('inbox', THU, sentTo('Mira', 'mira@example.com'), OWN, 'Draft and budget', 'Hi Alex,\n\nCan you review the draft by Friday? Also, Mira will send the budget on Monday.\n\nRegards', [{ type: 'request_to_me', what: 'Review draft', due: after(THU, 'Friday') }, { type: 'waiting_on', what: 'Send budget', due: after(THU, 'Monday') }], ['has_request', 'has_waiting', 'multi']);
add('sent', MON, OWN, sentTo('Tess', 'tess@example.com'), 'Agenda', "Hi Tess,\n\nI'll send the agenda tomorrow, and can you send me the attendee list by Wednesday?" + sig, [{ type: 'my_promise', what: 'Send agenda', due: Dates.addDays(MON, 1) }, { type: 'waiting_on', what: 'Send attendee list', due: after(MON, 'Wednesday') }], ['has_promise', 'has_waiting', 'multi']);
add('inbox', TUE, 'Admissions <admissions@college.example>', OWN, 'Fees and ID', 'Fees are due 28 Nov. Please also upload your ID proof by Friday.', [{ type: 'deadline', what: 'Pay fees', due: '2026-11-28' }, { type: 'request_to_me', what: 'Upload ID proof', due: after(TUE, 'Friday') }], ['has_deadline', 'has_request', 'multi']);
add('sent', WED, OWN, sentTo('Quinn', 'quinn@example.com'), 'Slides', "Hi Quinn,\n\nI'll send the slides today and the recording by Friday." + sig, [{ type: 'my_promise', what: 'Send slides', due: WED }, { type: 'my_promise', what: 'Send recording', due: after(WED, 'Friday') }], ['has_promise', 'multi']);

// ---------- nothing to extract ----------
const NEG = (direction, sent, from, to, subj, body, tags) => add(direction, sent, from, to, subj, body, [], tags);
const them = sentTo('Colleague', 'colleague@example.com');
NEG('sent', MON, OWN, them, 'Re: Update', 'Hi,\n\nWill do! Thanks for sending it over.' + sig, ['polite']);
NEG('sent', TUE, OWN, them, 'Re: Question', 'Hi,\n\nLet me check and get back to you.' + sig, ['polite']);
NEG('inbox', WED, them, OWN, 'Re: Files', 'Hi Alex,\n\nThanks, noted. Appreciate the quick reply.\n\nBest', ['polite']);
NEG('sent', THU, OWN, them, 'Re: Plans', 'Hi,\n\nSounds good, talk soon.' + sig, ['polite']);
NEG('sent', FRI, OWN, them, 'Catch up', 'Hi,\n\nWe should catch up sometime, it has been a while.' + sig, ['polite']);
NEG('sent', MON, OWN, them, 'Re: Event', "Hi,\n\nI'll try to make it, but no promises." + sig, ['polite']);
NEG('inbox', TUE, 'Product Weekly <news@productweekly.example>', OWN, 'This week in product', 'This week in product: five tips for better onboarding, a teardown of a pricing page, and the tools we are trying. Read the full issue on our site.', ['marketing']);
NEG('inbox', WED, 'CareerHub <jobs@careerhub.example>', OWN, 'Internships', 'Apply now! Internship applications close 30 Nov. Do not miss your chance to join a top team.', ['marketing', 'trap']);
NEG('inbox', THU, 'SecureBank <alerts@securebank.example>', OWN, 'Your code', 'Your verification code is 482913. Do not share it with anyone. It expires in 10 minutes.', ['automated']);
NEG('inbox', FRI, 'ShopFast <orders@shopfast.example>', OWN, 'Order shipped', 'Good news! Your order has shipped and will arrive on Friday. Track it from your account.', ['automated']);
NEG('inbox', MON, 'Accounts <security@accounts.example>', OWN, 'New sign-in', 'New sign-in to your account from Chrome on Windows. If this was you, no action is needed.', ['automated']);
NEG('inbox', TUE, 'Calendar <calendar@example.com>', OWN, 'Invitation', 'Invitation: Weekly sync, Tuesday at 3pm. Join with the link in the calendar event.', ['automated']);
NEG('inbox', WED, 'LearnLab <events@learnlab.example>', OWN, 'Webinar', 'Join our free webinar on 27 Nov and learn how top teams ship faster. Register now, seats are limited.', ['marketing', 'trap']);
NEG('inbox', THU, 'GadgetMart <deals@gadgetmart.example>', OWN, 'Flash sale', 'Flash sale! 40% off everything. Offer ends Sunday, so grab your favourites today.', ['marketing', 'trap']);
NEG('sent', FRI, OWN, them, 'Re: Report', 'Hi,\n\nI sent the report yesterday, let me know if you got it.' + sig, ['past']);
NEG('sent', MON, OWN, them, 'Re: Deck', 'Hi,\n\nIf I had more time I would redo the whole deck from scratch.' + sig, ['hypothetical']);
NEG('inbox', TUE, 'ShopFast <receipts@shopfast.example>', OWN, 'Your receipt', 'Thank you for your purchase. Your receipt is attached. Order number 4821.', ['automated']);
NEG('inbox', WED, 'SafeBank <statements@safebank.example>', OWN, 'Statement', 'Your monthly statement is ready to view online. Sign in to see your transactions.', ['automated']);
NEG('inbox', THU, them, OWN, 'Birthday', 'Happy birthday Alex! Hope you have a great day and a wonderful year ahead.', ['human']);
NEG('inbox', FRI, 'RideNow <offers@ridenow.example>', OWN, 'Refer a friend', 'Refer a friend and get Rs 500 off your next ride. Offer valid till 31 Dec.', ['marketing', 'trap']);
NEG('inbox', MON, 'TalentPool <hiring@talentpool.example>', OWN, 'Hiring', 'Senior roles are hiring now. Apply before 1 Dec and get fast-tracked.', ['marketing', 'trap']);
NEG('sent', TUE, OWN, them, 'Re: Launch', 'Hi team,\n\nThanks for the update, great work everyone.' + sig, ['polite']);
NEG('inbox', WED, 'Facilities <office@company.example>', OWN, 'Notice', 'FYI: the office will be closed on Friday for routine maintenance.', ['human']);
NEG('sent', THU, OWN, them, 'Re: Launch', 'Hi,\n\nCongrats on the launch, well deserved!' + sig, ['polite']);
NEG('inbox', FRI, 'Accounts <security@accounts.example>', OWN, 'Password changed', 'Your password was changed successfully. If you did not do this, contact support.', ['automated']);

const out = { generated: 'eval/build-synthetic.js', owner: ME, timezone: 'Asia/Kolkata', cases };
fs.writeFileSync(path.join(__dirname, 'synthetic-eval.json'), JSON.stringify(out, null, 1));
const pos = cases.filter((c) => c.expected.length).length;
console.log(`wrote ${cases.length} cases: ${pos} with items (${cases.reduce((a, c) => a + c.expected.length, 0)} expected items), ${cases.length - pos} with none`);
