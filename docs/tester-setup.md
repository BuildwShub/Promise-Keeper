# Promise Keeper: tester setup (plan.md Phase 6)

Two roles: **Developer** (you) and **Tester** (a friend or family member with a Gmail account).
Limits: an unverified app allows at most **100 test users**, and every tester sees an "unverified app" warning once.

## A. Developer: add a tester as an OAuth test user
1. Open **console.cloud.google.com** and select your project (top bar).
2. Open the menu (☰), then **APIs & Services**, then **OAuth consent screen**. This opens **Google Auth Platform**.
3. In the left list, click **Audience**.
4. Under **Test users**, click **+ Add users**, type the tester's Gmail address, and save.
5. Repeat for each tester (10 to 20 for this project).

## B. Developer: give the tester access to the script
1. Open **script.google.com** and open the project.
2. At the top right, click the **Share** icon (person with a plus).
3. Type the tester's Gmail address and set the role to **Viewer**. Click **Send**.
4. Do not use **Editor**: editors can read Script Properties, and the Gemini API key is stored there.

## C. Tester: install the add-on (VERIFIED with a second Gmail account)
Result of the check plan.md Phase 6 asks for: a **Viewer cannot install** (the Deploy button is missing). **Editor access is needed for the install only**, then the tester can be switched back to Viewer and the add-on keeps working.

1. Developer: in the script, click **Share**, set the tester's role to **Editor**, and save.
2. Tester opens the link from the share email, which opens the Apps Script project, and reloads it. The blue **Deploy** button now shows at the top right.
3. Tester clicks **Deploy**, then **Test deployments**, then **Install**, then **Done**.
4. Tester opens **mail.google.com**, presses **Ctrl+Shift+R**, and clicks the Promise Keeper icon in the right-hand strip. The panel says "Permission required": click **Grant permission**, choose the account, **Advanced**, **Go to … (unsafe)**, then tick **Select all** and click **Continue**.
5. Developer: change the tester back to **Viewer**. Editors can read Script Properties (the Gemini API key is stored there) and change the code, so do not leave testers as Editors. Replace the Gemini key in Script Properties if an Editor you do not fully trust had access.
6. Tester reloads Gmail: the add-on keeps working as a Viewer (checked: **Scan now** scanned messages).

Not used: a private or unlisted Google Workspace Marketplace listing (more setup, and for gmail.com users it may need Google review).

Known limit: a card button must finish in about 30 seconds, so **Scan now** and the Welcome card's scan process only a few messages per press ("Press again for more").

## D. Tester: first run
1. Click the Promise Keeper icon in Gmail's right-hand strip.
2. A permission window appears. Click **Review permissions**, choose your account, click **Advanced**, then **Go to … (unsafe)**, then **Allow**. This is the unverified-app warning and is expected.
3. The sidebar shows a **Welcome** card:
   - Step 1 of 3, Privacy: read what is sent and stored. Optionally switch on **Share anonymous usage numbers**. Click **I understand, continue**.
   - Step 2 of 3, Scan the last 7 days: press **Scan N more** until it says nothing is left (each press takes about 30 seconds), or click **Skip**. Then click **Continue**.
   - Step 3 of 3: click **Install and finish**.

## E. Developer: collect metrics (opt-in, aggregate numbers only)
The add-on can post counts and rates (never email content or addresses) once a day, only for testers who switched **Share anonymous usage numbers** on.
1. In Apps Script, click **Deploy**, then **New deployment**, then the gear icon, then **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL** ending in `/exec`.
2. Open **Project Settings** (gear icon), scroll to **Script properties**, click **Add script property**: name `METRICS_ENDPOINT`, value = the `/exec` URL. Save.
3. In the editor, open `Metrics.gs`. In the function dropdown at the top (to the right of **Debug**) choose `generateMetricsKey`, then click **Run**. The log says "METRICS_KEY saved in Script Properties." You do not need to note the key down.
4. After every code change that touches `Webapp.js`: **Deploy**, then **Manage deployments**, click the pencil icon, set **Version** to **New version**, and **Deploy**. The `/exec` URL runs the deployed version, not the latest code.
5. To see results: run `computeFleetMetrics` from `Metrics.gs`, then open the **Fleet** tab in your Promise Keeper DB sheet.

Each tester's own numbers are in the **Metrics** tab of their sheet (refreshed daily; or run `computeMetrics`).

## F. What the Metrics tab contains
| Metric | Meaning |
|---|---|
| accept_rate | accepted / (accepted + dismissed): real-world precision |
| edit_rate | items edited / decided items |
| on_time_rate | completed by due date / items with a due date that can be judged |
| on_time_rate_week1, week4 | the same rate for items created in week 1 and week 4 of use |
| digest_retention_d7, d30 | 1 if the tester opened or clicked a digest 7 to 13 (or 30 to 36) days after the first digest |
| extraction_precision | latest eval run |
