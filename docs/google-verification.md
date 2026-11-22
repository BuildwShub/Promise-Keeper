# Google OAuth verification and security assessment (notes for public launch)

Promise Keeper currently works for **test users only** (up to 100 Google accounts listed under Audience > Test users). Refresh tokens issued to
an unverified app in "Testing" status expire after 7 days of the consent being granted, so test users may be asked to sign in again weekly.
To open it to anyone, Google must verify the app. This page collects what that process needs. Nothing here is submitted yet.

## Scopes and why each is needed
| Scope | Class | Used for |
| --- | --- | --- |
| `gmail.readonly` | **Restricted** | Read Inbox and Sent messages to find promises, requests and deadlines. Only cleaned text (at most ~3,000 characters, no attachments) is sent to the model. Full bodies are never stored. |
| `gmail.compose` | **Restricted** | Create follow-up **drafts** in the user's mailbox. The app never sends. |
| `tasks` | Sensitive | Create and complete tasks in a "Promise Keeper" list when the user presses Accept or Done, and mark items done when a task is completed in Google Tasks. |
| `calendar.events` | Sensitive | Create all-day events for accepted deadlines; edit or remove them when the item changes. |
| `gmail.addons.execute`, `gmail.addons.current.message.metadata` | Sensitive | Show the side panel next to the open email. |
| `userinfo.email`, `userinfo.profile`, `openid` | Non-sensitive | Identify the account. |

Before applying, remove scopes that are declared but unused (the consent screen currently also lists `calendar.events.freebusy`,
`calendar.events.public.readonly`, `calendar.events.owned`, `calendar.events.owned.readonly`, `calendar.events.readonly` and `tasks.readonly`).

## What Google will require
1. **Restricted-scope security assessment (CASA).** Because of `gmail.readonly` and `gmail.compose`, apps that store or transmit Gmail data on
   servers need an annual third-party assessment (an authorised lab; it has a fee). Allow several weeks.
2. **Domain ownership.** A real domain verified in Google Search Console, used for the homepage, privacy policy and authorised domains.
   `*.vercel.app` cannot be verified as an app domain. Buy a domain, point it at the Vercel project, and add it under Branding > Authorised domains.
3. **Public pages** on that domain: homepage (what the app does), `/privacy`, and `/data-deletion` (both already built).
4. **Limited Use statement** in the privacy policy (already included) and compliance with the Google API Services User Data Policy: no advertising,
   no selling data, no human reading of mail except with consent or for security, and no use to train general AI models.
5. **Demo video** (unlisted YouTube) showing the OAuth consent screen with the real client ID, each scope being used, and where data is stored.
6. **Gemini on the paid tier.** The privacy page says inputs are not used to improve Google products; that is true only on the paid tier.

## Security controls already in place (for the assessment questionnaire)
- Refresh tokens encrypted at rest with AES-256-GCM; key held in an environment variable; token table has no row-level-security policy, so a user token cannot read it.
- Row-level security on every user table, keyed by a short-lived server-signed JWT.
- Add-on requests verified against Google's signing keys (issuer, audience, expiry, signature) and mapped to the user by the Google account id; fails closed when unconfigured.
- Cron and push endpoints protected by a shared secret compared in constant time; digest tracking uses HMAC-signed tokens and only redirects to Gmail.
- No full email bodies stored. Account deletion removes all rows and the token and logs only a one-way hash and row counts (tested end to end).
- Secrets live only in Vercel and Supabase settings and a git-ignored local file; none are in the repository.

## Still to do before applying
- Choose and verify a domain; replace the Vercel address everywhere (OAuth redirect URIs, `deployment.json`, `ADDON_BASE_URL`, Pub/Sub endpoint).
- Remove the unused scopes listed above.
- Add an audit trail for admin access to production data and an incident-response note (assessors ask for both).
- Decide on a public support email and replace the personal one on the privacy page.
