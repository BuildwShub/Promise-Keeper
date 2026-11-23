const Prompt = require('../shared/prompt.js');

describe('prompt: whose task is it', () => {
  const p = Prompt.buildSystemPrompt();
  test('an instruction the owner sends to someone else is never my_promise', () => {
    expect(p).toMatch(/NEVER my_promise/);
    expect(p).toMatch(/Send the required reports by EOD/);
  });
  test('sent instructions to the recipient or a group are waiting_on with the To header as counterparty', () => {
    expect(p).toMatch(/SENT email, a command, request or reminder aimed at the recipient/);
    expect(p).toMatch(/counterparty = the To header/);
  });
  test('the same sentence in received mail is a request to the owner', () => {
    expect(p).toMatch(/direction=inbox, from Meera: "Send the required reports by EOD\."/);
  });
  test('an email with both an ask and a promise yields both types in the example', () => {
    expect(p).toMatch(/waiting_on "Prepare the slides"[\s\S]*my_promise "Review the slides"/);
  });
});
