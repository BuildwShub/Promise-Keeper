# Promise Keeper for Gmail: Product Requirements Document

| | |
| --- | --- |
| **Owner** | Shubham Kanauji, Product Manager |
| **Status** | v1.0, 23 Nov 2026 |
| **Product** | Promise Keeper for Gmail (live: Gmail add-on + web app) |
| **How this document was made** | Written **after** the MVP was built, from the original implementation plan (plan.md), the measured evaluation data and the shipped product. It records the reasoning and the evidence. It is not a pre-build document, and sections that rest on assumptions say so. |

---

## 1. Summary

**One line.** Promise Keeper reads both sides of a Gmail conversation (Inbox *and* Sent), finds every commitment, and turns each into one item the user can accept, edit or dismiss, so nothing promised, asked or owed gets lost.

**Why now.** Email is where work commitments are made, and most commitment-tracking depends on the user remembering to write things down. Tools that read email look mainly at the Inbox (what others ask of you). The promises you make live in the Sent folder, and nothing reads them.

**What exists today.** A Gmail side-panel add-on, a web dashboard, Google Tasks and Calendar sync, a morning digest email, one-tap follow-up drafts, and an evaluation harness that scores the extractor before any change ships.

**Headline evidence (measured):** on 106 hand-labelled real emails the extractor shows 100% precision (0 false alarms across 97 emails with nothing to find), 77.8% recall (7 of 9 real commitments) and 100% date accuracy. A second test of 76 synthetic emails gives 92.3% precision and 90.6% recall under strict scoring.

**Biggest gaps (honest):** no external user evidence yet, only 9 real positive examples in the labelled set, and the app is unverified by Google, so it is capped at 100 test users.

---

## 2. Problem

### 2.1 Problem statement
People make and receive commitments in email, then lose track of them. A promise made in a reply ("I'll send the deck by Friday") exists nowhere else. A request ("Can you review this by EOD?") sits between dozens of other messages. A promise someone made to you ("Report is on the way") goes quiet with no reminder to chase. The cost is lost trust, missed deadlines and time spent searching.

### 2.2 What the evidence says
| Claim | Evidence | Strength |
| --- | --- | --- |
| Email takes a large share of knowledge work | McKinsey Global Institute estimated that "interaction workers" spend about **28% of the workweek** managing email ([McKinsey, *The social economy*, 2012](https://www.mckinsey.com/featured-insights/productivity-growth/the-social-economy)). | Credible source, but **dated (2012)** |
| Email volume is huge and growing | Radicati forecasts about **361.6 billion** emails per day worldwide in 2024, rising to 424.2 billion by 2028 ([Radicati Email Statistics Report 2024-2028](https://radicati.com/wp/wp-content/uploads/2024/10/Email-Statistics-Report-2024-2028-Executive-Summary.pdf)). | Industry analyst, paid report; summary only |
| Gmail is a large platform | About **1.8 billion** monthly active users is the common third-party estimate ([Statista chart](https://www.statista.com/statistics/432390/active-gmail-users/), [Techjury](https://techjury.net/industry-analysis/gmail-usage/)). I found no official Google figure; some sites quote 2.5 billion without a source. | **Weak: third-party estimates** |
| Many people run on commitments to clients | Upwork's 2023 *Freelance Forward* survey estimated **64 million Americans** freelanced in the past year (38% of the US workforce), using a broad definition (any freelance work in 12 months) ([Upwork press release](https://www.upwork.com/press/releases/upwork-study-finds-64-million-americans-freelanced-in-2023-adding-1-27-trillion-to-u-s-economy)). | Survey of 3,000 adults, ±1.7%; broad definition |
| People actually lose commitments in their own mail | **No primary evidence collected yet.** | **Hypothesis** (see section 11) |

The last row matters most. The market numbers show that email is big. They do not show that *this* problem hurts enough for people to adopt a tool. That has to come from user research.

### 2.3 Why existing tools fall short (hypothesis, from competitive review)
- To-do apps only know what you type into them.
- Inbox AI mostly works on what others send you and when you ask for it.
- Follow-up reminder tools are time-based (no reply by a date), not based on what was actually promised.

---

## 3. Users

> Personas below are **hypotheses** from the plan and the builder's own use. They have not been validated with interviews.

| Segment | Who | Job to be done | Why Gmail-first fits |
| --- | --- | --- | --- |
| **Primary: individual employees** (product, ops, sales, support) | People with many cross-team commitments made by email | "Help me not drop what I told people I would do." | Gmail / Google Workspace is where they already work |
| **Managers** | People who delegate and wait on others | "Show me what is owed to me and what is late." | Waiting-on items and the digest |
| **Freelancers** | Solo workers with client promises and invoices | "Track every client promise and chase every payment." | Single inbox, no team tools |
| **Creators** | Sponsor deliverables and deadlines in email | "Never miss a sponsor deadline." | Deadline items plus Calendar |

**Beachhead.** One user, one inbox, Gmail: start with individuals who use Gmail for work, because they need no team rollout and no IT approval.

---

## 4. Market size (method shown, assumptions flagged)

I am deliberately **not** presenting a single big number. Market size from top-down percentages is easy to inflate. The honest version is a funnel with each step labelled as sourced or assumed.

| Step | Value | Source / status |
| --- | --- | --- |
| Gmail monthly active users | about 1.8 billion | Third-party estimate (above) |
| of which use Gmail substantially for work or client communication | **unknown** | **Assumption to replace.** Needs a sourced figure or a survey |
| of which feel commitment-tracking pain strongly enough to try a tool | **unknown** | **Assumption to replace.** Needs user research |
| Reachable today (SOM) | **at most 100 users** | **Fact:** unverified Google OAuth apps are capped at 100 users until verification and a security assessment |

**Illustrative scenarios, not findings** (to show the method):

| Scenario | Work users (of 1.8B) | Feel the pain | Resulting segment |
| --- | --- | --- | --- |
| Conservative | 5% (90M) | 5% | 4.5M |
| Base | 10% (180M) | 10% | 18M |
| Optimistic | 15% (270M) | 15% | 40.5M |

These percentages are placeholders. Replace them with survey data before using any of them in an interview or application.

---

## 5. Competitive landscape

> Checked against public pages on 23 Nov 2026. Competitor features change often, so verify before quoting.

| Alternative | What it does | Gap Promise Keeper targets |
| --- | --- | --- |
| **Gemini in Gmail** | Side panel can summarize a thread and, when asked, list action items or suggest to-dos ([Google help: Collaborate with Gemini in Gmail](https://support.google.com/mail/answer/14355636)). Availability varies by plan and device. | User-initiated, thread by thread. Promise Keeper works proactively across Inbox and Sent, quotes the sentence it found, and keeps a status for every item |
| **Boomerang for Gmail** | Resurfaces a message if there is no reply by a set time; plans from about $5 to $50/month depending on the source ([Capterra](https://www.capterra.com/p/174835/Boomerang/pricing/)) | Time-based reminders, not content-based. Does not know *what* was promised |
| **Superhuman** | Full email client, Starter plan listed at about $30/month ([G2](https://www.g2.com/compare/boomerang-for-gmail-vs-superhuman-mail)). I did not verify follow-up features. | Replaces the client; Promise Keeper adds to the one people already use |
| **Google Tasks / to-do apps** | Manual capture | Capture is the problem; Promise Keeper captures automatically, then hands off to Tasks and Calendar |
| **Automagical Nudge** (Gmail add-on) | Automated follow-up sequences | Sequences, not commitment extraction |

**Positioning (to test):** the only tool that reads *your own sent promises* as well as what you receive, shows proof for every item, and never acts without your approval.

---

## 6. Goals, non-goals and success metrics

### 6.1 Goals
1. Find real commitments from both sides of the conversation with **very few false alarms**.
2. Make acting on each item take **one tap** (Accept, Edit, Dismiss).
3. Keep the user in control: **nothing is added or sent without approval**.
4. Make the product **understandable at a glance** for a global audience.

### 6.2 Non-goals (this version)
Meeting invites, attachments, Outlook, mobile-specific UI, auto-sending any email, team or shared inboxes.

### 6.3 Metrics

| Layer | Metric | Definition | Current value | Target |
| --- | --- | --- | --- | --- |
| **North star** | On-time rate | Completed by the due date / items with a due date that can be judged | 67% (2 of 3; tiny sample) | **Proposed: 80% or more over 30 days with 20+ users** |
| Quality gate | Extraction precision | Shown items that were correct (labelled set) | **100%** (7 of 7) | Gate: 85% or more (met) |
| Quality gate | Date accuracy | Dates that matched the label | **100%** | Gate: 85% or more (met) |
| Quality | Recall | Real items found | **77.8%** (7 of 9) | Proposed: 85% or more on a larger set |
| Trust | False alarms | Items shown that were not real | **0 in 97** emails | Proposed: under 5% of shown items |
| Engagement | Accept rate | Accepted / (accepted + dismissed) | 57% (4 of 7; includes test clicks) | Proposed: 60% or more |
| Engagement | Digest engagement | Days with a digest open or click | 3 of 6 sent | Proposed: opened on 50% of days |
| Retention | Digest retention D7 / D30 | Engaged in days 7-13 / 30-36 after the first digest | Not enough data | Proposed: D30 above 30% |
| Guardrail | Emails sent on the user's behalf | Count | **0 by design** | Always 0 |
| Guardrail | Email bodies stored | Count | **0 by design** | Always 0 |

"Current" values come from one user's inbox plus test data. They show the system works, not that it works for the market.

---

## 7. Requirements

### 7.1 Functional

| ID | Priority | Requirement | Status |
| --- | --- | --- | --- |
| F1 | P0 | Extract four item types: my promise, request to me, deadline, waiting on, each with the quoted sentence | Shipped |
| F2 | P0 | Read both Inbox and Sent | Shipped |
| F3 | P0 | Gmail sidebar per conversation with Accept, Edit, Dismiss | Shipped |
| F4 | P0 | Accepted items create a Google Task (due date and link back); deadlines also create a Calendar all-day event; never duplicates | Shipped |
| F5 | P0 | Nothing added or sent without user approval | Shipped |
| F6 | P1 | Morning digest: overdue, due today, this week, waiting on others, with open and click tracking | Shipped |
| F7 | P1 | One-tap follow-up draft for late waiting-on items, created as a Gmail draft (never sent) | Shipped |
| F8 | P1 | Flag when a counterparty replied in a thread the user was waiting on | Shipped |
| F9 | P1 | Web dashboard grouped by due date, summary tiles that filter | Shipped |
| F10 | P1 | Metrics page: rates, formulas behind an info icon, interactive trend graphs | Shipped |
| F11 | P1 | Evaluation harness with a pass/fail gate; same results on both runtimes | Shipped |
| F12 | P2 | Hinglish and mixed-language emails | Shipped (in prompt and eval set) |
| F13 | P2 | Settings: timezone, digest hour, auto-add (off by default), delete my data | Shipped |

### 7.2 Non-functional

| Area | Requirement | Status |
| --- | --- | --- |
| Privacy | Store only extracted items and the evidence sentence; never full bodies; refresh tokens encrypted (AES-256-GCM); delete-my-data tested | Met |
| Security | Row-level security per user; signed Google tokens verified on every add-on request; secrets rotated after exposure | Met |
| Freshness | New email becomes an item within about a minute of arrival | Verified in testing |
| Reliability | Idempotent scans: no duplicate items or tasks | Verified |
| Quality | A prompt must pass the gate before shipping | Enforced |
| Accessibility | Colour always paired with a word or icon; readable on small screens | Designed; not formally tested |

---

## 8. Design and UX decisions

The first version worked but asked people to read dense text. The redesign aimed to let people *see* the situation at a glance. Evidence: the before and after screenshots and the options compared in [`docs/design/`](design/).

| Principle | What changed | Why |
| --- | --- | --- |
| Show, don't tell | Sidebar card leads with a coloured date line, a type icon and the quoted sentence | Dates and types are the first thing people look for |
| Group by urgency | Dashboard groups items as overdue, due today, this week, later, with a calendar tile | People plan by "when", not by item type |
| Summary as filter | The four count tiles filter the list in one click | Fewer steps from "what is late?" to the items |
| Progressive disclosure | Formulas and explanations live behind an **i** icon | Beginners stay calm; experts can still check the maths |
| Meaningful colour | Google palette; rates are green at 90% or more, amber at 80 to 89%, red below | One quick read of health, always with a word |
| One primary action | Each card has one filled button | Reduces decision effort |

These are **design decisions made on judgement and comparison of options, not on measured user results.** Testing with real users is open work (section 11).

---

## 9. What was built and learned

| Phase | Outcome |
| --- | --- |
| Extraction engine and labelled set | Built; gate set at precision 85% or more and date accuracy 85% or more before any UI work |
| Prompt v1 | **Failed the gate**: precision 83%, recall 56% |
| Prompt v2 | Fixed after reading the misses (promotional deadlines no longer tasks; automated action-required notices count as requests): precision **100%**, recall **78%**, gate passed |
| Stage A (Apps Script + Sheets) | Gmail sidebar, Tasks and Calendar, digest, nudges, metrics |
| Stage B (Vercel + Supabase) | Push-based intake, web dashboard, digest, same evaluation results as Stage A |
| Synthetic test (76 emails) | Precision 92.3%, recall 90.6%, date accuracy 100%. Four of four "false alarms" and four of five "misses" were the same four emails phrased differently from my labels. Written by me, so less independent. |
| Redesign | New design across sidebar, dashboard, digest, metrics, graphs |

**Key learning:** the biggest quality win came from reading individual failures and fixing the prompt, not from tuning numbers. Building the evaluation first made false alarms measurable, which is the number that decides whether people keep using a tool like this.

---

## 10. Risks

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| **Gmail restricted scope**: going public needs Google verification and a paid security assessment | Blocks growth past 100 users | Design already stores minimal data, encrypts tokens, never stores bodies; steps in [`google-verification.md`](google-verification.md) | Open |
| False alarms erode trust | Users stop using it | Suggest-only, evidence quote, confidence threshold, negative examples, gate | Mitigated; watch in real use |
| Missed commitments (recall 78%, rests on 9 examples) | Users miss items and lose confidence | Grow the real positive set; track in metrics | Open |
| Privacy concerns about reading email | No adoption | Clear privacy page, delete-my-data, no bodies stored, no auto-send | Mitigated |
| Dependence on the Gemini API (free-tier limits seen in testing) | Slow or failed extraction at scale | Pacing and backoff now; paid key before inviting others | Open |
| Platform risk: Google could ship the same feature in Gmail | Reduces the opening | Differentiate on Sent-folder commitments, proof and follow-up; move fast | Open |
| Email delivery limits (digest provider only delivers to the account owner on the free plan) | Digest cannot reach testers | Verify a sending domain | Open |

---

## 11. Open questions and next steps

**Open questions**
1. Do people actually lose commitments often enough to want a tool? How often, and what does it cost them?
2. Which segment feels the pain most: employees, managers, freelancers or creators?
3. Is 78% recall good enough that people still trust it? What is the acceptable miss rate?
4. Would people pay, and who pays: the individual or the employer?

**Next steps (proposed)**
1. **User research:** 5 to 8 short interviews with people who send many emails, plus a survey. Replace the section 4 assumptions with real figures.
2. **Usability test:** 5 people, a fixed script, watch them find and accept a promise in under a minute. Compare the old and new design.
3. **Grow the evaluation set** with more real positive examples.
4. **Pilot:** 10 to 20 testers for 4 weeks; measure accept rate, on-time rate and D7 retention against the targets in section 6.3.
5. **Decide on verification:** only pursue Google verification and the security assessment if the pilot shows retention.

---

## 12. Launch plan

| Stage | Audience | Gate to move on |
| --- | --- | --- |
| 1. Self | The builder | Extraction gate passed (done) |
| 2. Pilot | 10 to 20 test users (within the 100-user cap) | Accept rate and on-time rate at target; no privacy incidents |
| 3. Verification | Public beta | Google verification and security assessment complete |
| 4. Growth | Employees, then freelancers and creators | Retention D30 at target |

---

## Appendix A: Decision log

| Decision | Reason |
| --- | --- |
| Read **Sent** as well as Inbox | The gap in existing tools; where one's own promises live |
| Suggest only, never auto-add or auto-send | Trust: false alarms and surprise emails are the fastest way to lose users |
| Evaluation gate before building UI | Extraction quality is the product |
| Hybrid build: shared modules for Apps Script and Next.js | Prove it fast in Stage A, then scale without rewriting the extractor; both runtimes give identical eval results |
| Gmail first, Outlook later | One platform to prove the value; Outlook is a stated vision, not shipped |
| Digest via an email provider, not the Gmail send scope | Avoids requesting an extra restricted scope |
| Redesign with a Google-style palette and information hierarchy | Faster comprehension for a global audience (to be validated with users) |

## Appendix B: Sources

- McKinsey Global Institute, *The social economy* (2012): https://www.mckinsey.com/featured-insights/productivity-growth/the-social-economy
- Radicati Group, *Email Statistics Report 2024-2028* (executive summary): https://radicati.com/wp/wp-content/uploads/2024/10/Email-Statistics-Report-2024-2028-Executive-Summary.pdf
- Gmail active users (third-party estimates, no Google figure): https://www.statista.com/statistics/432390/active-gmail-users/ and https://techjury.net/industry-analysis/gmail-usage/
- Upwork, *Freelance Forward 2023*: https://www.upwork.com/press/releases/upwork-study-finds-64-million-americans-freelanced-in-2023-adding-1-27-trillion-to-u-s-economy
- Google Help, Collaborate with Gemini in Gmail: https://support.google.com/mail/answer/14355636
- Boomerang pricing (Capterra): https://www.capterra.com/p/174835/Boomerang/pricing/
- Superhuman and Boomerang comparison (G2): https://www.g2.com/compare/boomerang-for-gmail-vs-superhuman-mail
- Project evidence: [`README.md`](../README.md), [`eval/synthetic-results.json`](../eval/synthetic-results.json), [`docs/design/`](design/)
