# Promise Keeper for Gmail: Test Cases

Three kinds of testing are described here. The status column is honest: **Pass** means I ran it and saw it work, **Automated** means a test in the repo checks it on every run, **Not run** means the case is written but I have not executed it yet.

| Part | What | Where it runs |
| --- | --- | --- |
| A | Automated tests (157) | `npx jest` in the repo root (89) and in `web/` (68) |
| B | Manual end-to-end and acceptance cases | A real Gmail account and the live app |
| C | Usability test script (5 participants) | Not run yet |

Last updated: 23 Nov 2026.

---

## A. Automated tests (157 passing)

Run them: `npm test` in the repo root, then `cd web && npm test`.

### A1. Shared extraction modules (root, 89 tests)
These modules run identically in the Apps Script add-on and the Next.js app.

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/clean.test.js` | 15 | Quoted replies, signatures and HTML are stripped before the model sees the email |
| `tests/dates.test.js` | 8 | Relative dates ("Friday", "next Tuesday", "end of week") resolve against the sent date; date buckets (overdue, today, week, later) |
| `tests/dedup.test.js` | 6 | The same commitment is not shown twice |
| `tests/validate.test.js` | 14 | Model output is validated: evidence sentence must really appear in the email, bad types and dates are rejected; prompt and scoring (precision, recall, gate) behave correctly |
| `tests/outputs.test.js` | 10 | Task and Calendar resources are built correctly (due date, link back, all-day events only for deadlines) |
| `tests/digest.test.js` | 14 | Morning digest sections and ordering, HTML is escaped, tracking links, nudge text |
| `tests/metrics.test.js` | 13 | Accept rate, edit rate, on-time rate (week 1 and week 4), digest retention |
| `tests/migrate.test.js` | 9 | Importing the old spreadsheet data into the database |

### A2. Web app (web/, 68 tests)

| File | Tests | What it proves |
| --- | --- | --- |
| `web/tests/addon.test.ts` | 22 | Google-signed tokens are verified; **requests fail closed** when anything is missing or wrong; sidebar cards show the right buttons for each item status; text is HTML-escaped; links point at the right endpoints |
| `web/tests/digest.test.ts` | 9 | Tracking tokens cannot be forged; **no open redirect** (only Gmail links are allowed); digest links name the right Gmail account |
| `web/tests/eval.test.ts` | 5 | The evaluation runner scores the labelled set and applies the gate |
| `web/tests/guard.test.ts` | 4 | The push-notification secret is checked, including URL-encoded variants |
| `web/tests/history.test.ts` | 4 | Only Inbox and Sent mail is processed; promotions, social, spam, trash and drafts are skipped |
| `web/tests/intake.test.ts` | 11 | Message parsing, sent-date handling, secret comparison, extraction wiring |
| `web/tests/lib.test.ts` | 10 | AES-256-GCM token encryption round trip and tamper detection; user JWT signing; shared modules load in the web app |
| `web/tests/users.test.ts` | 3 | Delete-my-data removes everything; user ids are hashed in the deletion log |

### A3. Extraction quality (evaluation, not unit tests)
| Test | Command | Result |
| --- | --- | --- |
| 106 labelled real emails (gate: precision at least 85% and date accuracy at least 85%) | `/admin/eval` page, or `Eval` in the add-on | Precision 100%, recall 77.8%, date accuracy 100%, **gate pass** |
| 76 synthetic emails, strict scoring | `node eval/build-synthetic.js` then `node eval/run-synthetic.js` | Precision 92.3%, recall 90.6%, date accuracy 100%, gate pass |
| Same results on both runtimes | Run the eval through the web pipeline | Reproduced the add-on's numbers exactly |

---

## B. Manual end-to-end and acceptance cases

Pre-condition for all: signed in with a Google account that is a test user of the app; the Gmail add-on is installed.

### B1. Extraction and sidebar
| ID | Scenario | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-01 | A promise in a sent email is found | Send yourself "I'll send the deck by Friday". Open the thread. | Sidebar shows an "I promised" item with the date and the quoted sentence | Pass |
| TC-02 | A request in a received email is found | Receive "Can you review this by EOD?" | "Asked of me" item, due today | Pass |
| TC-03 | A deadline is found | Receive "Fee due 20 Nov" | "Deadline" item with the right date | Pass |
| TC-04 | Waiting-on is found | Receive "The report is on the way" | "Waiting on them" item | Pass |
| TC-05 | Hinglish | Send "Theek hai, kal tak bhej dunga" | Item due tomorrow | Pass |
| TC-06 | Nothing to find | Open a marketing or automated email | No item, no false alarm | Pass (0 false alarms in 97 labelled emails) |
| TC-07 | New mail appears quickly | Send a test promise | Item appears within about a minute without clicking anything | Pass |
| TC-08 | Rescan is safe | Scan the same message twice | No duplicate items | Automated (dedup tests); live rescan not re-run |

### B2. Accept, edit, dismiss
| ID | Scenario | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-09 | Accept creates a task | Press **Accept** on an item | Google Task appears with the due date and a link back to the email | Pass |
| TC-10 | Accept a deadline | Accept a "Deadline" item | Task **and** an all-day Calendar event | Not re-run on the web app |
| TC-11 | Accept twice | Press Accept again | No duplicate task or event | Not run |
| TC-12 | Edit | Change the text or date, save | Item updates; if already accepted, the task and event update too | Not run |
| TC-13 | Dismiss | Press **Dismiss** | Item moves to Dismissed; task and event are removed if they existed | Pass |
| TC-14 | Mark done | Press **Done** | Item moves to Done | Pass |
| TC-15 | Completing the task in Google Tasks | Tick the task in Google Tasks, wait for the next scan | Item becomes Done | Not run |

### B3. Digest and follow-up
| ID | Scenario | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-16 | Digest content | Send the digest | Overdue, due today, this week and waiting-on sections; late items flagged | Pass |
| TC-17 | Digest tracking | Open the digest, click a row | Open and click events are recorded; the link opens the right thread in the right Gmail account | Pass |
| TC-18 | Follow-up draft | Press **Draft follow-up** on a late waiting-on item | A threaded **draft** exists in Gmail and nothing was sent | Pass |
| TC-19 | Counterparty replies | The other person replies in a waiting-on thread | Item is flagged "They may have delivered" | Not run |

### B4. Web dashboard and Metrics (current design)
| ID | Scenario | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-20 | Grouping | Open `/items` | Items grouped as overdue, due today, this week, later, no date; counts match the tiles | Not run on live data |
| TC-21 | Tile filters | Click "Due today" | Only those items show; a "Showing: Due today" bar appears; clicking again clears it | Not run on live data |
| TC-22 | Info icons | Hover or click an **i** | A tooltip explains the item or metric | Not run on live data |
| TC-23 | Metrics values | Open `/metrics` | Rates match the formulas behind each **i**; colours follow 90% / 80% | Not run on live data |
| TC-24 | Trend graphs: range | Choose 7, 30, 90 days, All time, Custom | Graphs 1, 2 and 4 update to the range | Not run on live data |
| TC-25 | Trend graphs: legend and hover | Click a legend item; hover a block | Series hides; tooltip shows counts | Not run on live data |
| TC-26 | Empty state | Sign in as a user with no data | Page shows "n/a" and "Not enough data yet", no errors | Not run |
| TC-27 | Small screen | Open the dashboard at phone width | Cards stack, no sideways scrolling | Not run |

### B5. Security and privacy
| ID | Scenario | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-28 | Add-on call without a Google token | Call `/api/addon/message` without a valid token | Rejected (fails closed) | Automated |
| TC-29 | Forged tracking link | Change the user id in a digest link | Rejected | Automated |
| TC-30 | Open redirect | Put a non-Gmail URL in a tracking link | Blocked | Automated |
| TC-31 | Wrong push secret | Send a push notification with a wrong secret | 401 | Pass |
| TC-32 | Delete my data | Settings, type DELETE | Items, decisions, settings, events, token and account are removed; tasks and events already in Google stay | Pass |
| TC-33 | No bodies stored | Inspect the database after a scan | Only extracted items and the evidence sentence | By design; database not re-inspected |
| TC-34 | Never sends mail | Use Draft follow-up | Only a draft; no sent message | Pass |

### B6. Known gaps to test next
- Real second user (not the owner): digest delivery needs a verified sending domain.
- A busy mailbox: sustained use with the Gemini free-tier quota.
- Accessibility check with a screen reader and a colour-blindness simulator.

---

## C. Usability test script (5 participants)

**Goal.** Find out whether a new user understands what Promise Keeper found, and acts on it, without help. Also compare the first design with the current one.

**Who.** 5 people who send many work emails, ideally a mix: 2 employees, 1 manager, 1 freelancer, 1 creator. Do not use friends who know the product.

**Setup.** A test Gmail inbox with 6 prepared emails (2 promises, 1 request, 1 deadline, 1 waiting-on, 1 with nothing to find). Show the prepared mailbox on a shared screen; record with consent. Half the participants see the first design first, half the current design first, to avoid order effects.

**Consent line (read aloud).** "I am testing the product, not you. I will record the screen. Nothing you say affects you. You can stop any time."

### C1. Five-second test
Show the sidebar card for 5 seconds, then hide it. Ask: "What was it about? What is due? What would you press?" Note what they recall.

### C2. Tasks (no hints)
| # | Task | Success | Record |
| --- | --- | --- | --- |
| 1 | "Open the email from Daniel and tell me what the tool found." | Names the commitment and date | Time, wrong answers |
| 2 | "Add it to your to-do list." | Presses Accept | Time to Accept, any hesitation |
| 3 | "Find what is due today across everything." | Uses the dashboard group or tile filter | Time, route taken |
| 4 | "Something here is not a real commitment. Remove it." | Presses Dismiss | Time |
| 5 | "You are waiting on a supplier who has gone quiet. Chase them." | Uses Draft follow-up and notices it is only a draft | Understood it was not sent? |
| 6 | "How well is the tool doing for you?" (Metrics page) | Can read the summary sentence and one ring | What they think each colour means |
| 7 | "Where could you find out how that number is worked out?" | Finds the **i** icon | Found it? Time |

### C3. Questions after
1. In your own words, what does this product do?
2. Who would you recommend it to, and why?
3. What was confusing? What was missing?
4. How much would you trust it with your email? What would raise your trust?
5. Which design (first or current) felt clearer? Why?

### C4. Scoring sheet
| Measure | How | Target (proposed) |
| --- | --- | --- |
| Task success | Completed without help, out of 7 tasks | 6 of 7 or more per person |
| Time to first Accept | From opening the email | Under 30 seconds |
| Comprehension | Explains the product correctly in task Q1 | 4 of 5 participants |
| Trust | 1 to 5 rating (Q4) | Average 4 or more |
| Preference | Which design they pick | Record only |
| Errors | Wrong buttons, wrong readings | Count and categorise |

**Reporting.** Quote real participant words, list the top 3 problems by how many people hit them, and decide one change per problem. Do not report percentages from 5 people; report counts ("4 of 5").

**Limit.** Five people finds the main usability problems but gives no statistical proof. It supports design decisions; it does not measure market demand.
