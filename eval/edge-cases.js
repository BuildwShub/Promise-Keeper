/** Edge cases for "whose task is it?" (direction and subject). Owner = alex.morgan@example.com. Mon 2026-11-23.
 *  expect: the exact set of item types allowed to come back ([] = nothing). Run: node eval/run-edge.js */
const S = '2026-11-23T10:30:00+05:30';
const sent = (id, to, body, expect) => ({ id, direction: 'sent', from: 'Alex Morgan <alex.morgan@example.com>', to, subject: 'Update', body, expect });
const inbox = (id, from, body, expect) => ({ id, direction: 'inbox', from, to: 'Alex Morgan <alex.morgan@example.com>', subject: 'Update', body, expect });
module.exports = { owner: 'alex.morgan@example.com', timezone: 'Asia/Kolkata', sentIso: S, cases: [
  // The reported bug: an instruction the owner writes to someone else.
  sent('e01', 'toughgamer98@gmail.com', 'Send the required reports by EOD', ['waiting_on']),
  sent('e02', 'Ravi <ravi@example.com>', 'Hi Ravi,\n\nPlease send me the invoice by Monday.\n\nThanks,\nAlex', ['waiting_on']),
  sent('e03', 'Ravi <ravi@example.com>', 'Can you share the deck by Friday?', ['waiting_on']),
  sent('e04', 'Ravi <ravi@example.com>', 'Hi Ravi, you need to submit the form by Wednesday.', ['waiting_on']),
  sent('e05', 'Ravi <ravi@example.com>', "Don't forget to send the reports by EOD.", ['waiting_on']),
  sent('e06', 'Team <team@example.com>', 'Team, submit your timesheets by Friday.', ['waiting_on']),
  sent('e07', 'Ravi <ravi@example.com>', 'I need you to send the signed contract by Thursday.', ['waiting_on']),
  sent('e08', 'Ravi <ravi@example.com>', 'Ravi, kal tak report bhej dena.', ['waiting_on']),
  // The owner's own promises must still be found.
  sent('e09', 'toughgamer98@gmail.com', "I'll send the required reports by EOD.", ['my_promise']),
  sent('e10', 'Ravi <ravi@example.com>', 'We will share the report tomorrow.', ['my_promise']),
  sent('e11', 'Ravi <ravi@example.com>', 'Will send the report by Friday.', ['my_promise']),
  sent('e12', 'Ravi <ravi@example.com>', 'Theek hai, kal tak bhej dunga.', ['my_promise']),
  sent('e13', 'Ravi <ravi@example.com>', 'Sure, I can have the numbers ready by Thursday.', ['my_promise']),
  // Both in one email.
  sent('e14', 'Ravi <ravi@example.com>', "Ravi, please prepare the slides by Thursday. I'll review them on Friday.", ['waiting_on', 'my_promise']),
  sent('e15', 'Ravi <ravi@example.com>', "I'll send you the draft by Wednesday. Please send me your comments by Friday.", ['my_promise', 'waiting_on']),
  // Someone else commits to the owner.
  sent('e16', 'Ravi <ravi@example.com>', 'Thanks. So Priya will send the figures on Monday.', ['waiting_on']),
  inbox('e17', 'Meera <meera@example.com>', "I'll send the required reports by EOD.", ['waiting_on']),
  inbox('e18', 'Meera <meera@example.com>', 'Rahul said he would share the budget on Friday.', ['waiting_on']),
  // Others ask the owner.
  inbox('e19', 'Meera <meera@example.com>', 'Send the required reports by EOD.', ['request_to_me']),
  inbox('e20', 'Meera <meera@example.com>', 'Please send me the required reports by EOD.', ['request_to_me']),
  // A form with a date is a deadline by the prompt's own definition ("Submit form before 25th"), so deadline is the correct type here.
  inbox('e21', 'Meera <meera@example.com>', 'Reminder: you need to submit the form by Friday.', ['deadline']),
  // Nothing to find.
  sent('e22', 'Ravi <ravi@example.com>', 'Will do! Thanks.', []),
  sent('e23', 'Ravi <ravi@example.com>', 'Please see the attached file. Let me know what you think.', []),
  sent('e24', 'Ravi <ravi@example.com>', 'Thanks for the update, noted.', []),
  inbox('e25', 'Meera <meera@example.com>', 'Thanks, sounds good. Lets catch up sometime.', []),
] };
