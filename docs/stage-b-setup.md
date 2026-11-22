# Stage B setup (plan.md Phase 7): accounts, keys and local run

Never paste secret values into chat. Put them only in `web/.env.local` (git-ignored) and, later, in Vercel's Environment Variables.

## Part 1: Supabase (database)
1. Open **supabase.com** and sign in. Click **New project**.
2. Set **Name** `promise-keeper`, choose a **Database password** (save it in a password manager), pick the **Region** closest to you, keep the **Free** plan, and click **Create new project**. Wait about 2 minutes.
3. **Create the tables.** In the left menu click **SQL Editor**, then **New query**. On your computer open the file `G:\Gmail Feature Integration\supabase\migrations\0001_init.sql`, select everything (Ctrl+A), copy (Ctrl+C), paste into the editor, and click **Run**. You should see "Success. No rows returned."
4. Click **Table Editor** in the left menu. You should see these tables: `users`, `oauth_tokens`, `processed_messages`, `items`, `feedback`, `events`, `settings`, `eval_runs`, `message_queue`, `deletion_log`.
5. **Copy three values** (do not post them anywhere):
   - Click the **gear icon** (**Project Settings**), then **API** (it may be called **API Keys** or **Data API**). Copy **Project URL**. Copy the **service_role** key (click **Reveal** first). This one is a secret.
   - Still in **Project Settings**, open **JWT Keys** (or **JWT Settings**). Find the **Legacy JWT Secret** (click **Reveal**) and copy it.
   - If you cannot find a "Legacy JWT Secret", tell me what the JWT page shows. Do not paste any key.

## Part 2: Google OAuth web client (sign-in for the web app)
Use the same Google Cloud project as the add-on.
1. Open **console.cloud.google.com/auth/clients** and click **Create client**.
2. Set **Application type** to **Web application** and **Name** to `Promise Keeper Web`.
3. Under **Authorized redirect URIs** click **+ Add URI** and enter `http://localhost:3000/api/auth/callback/google`. Click **Create**.
4. A window shows the **Client ID** and **Client secret**. Copy both (do not post them).
5. Open **console.cloud.google.com/auth/scopes** and click **Add or remove scopes**. Tick: `.../auth/gmail.readonly`, `.../auth/gmail.compose`, `.../auth/tasks`, `.../auth/calendar.events`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` and `openid`. Click **Update**, then **Save**. (Use the filter box to find each one.)
6. Your existing test users keep working (**Audience**, **Test users**).

## Part 3: create your local env file
1. In File Explorer open `G:\Gmail Feature Integration\web`. Copy the file `.env.example` and name the copy `.env.local`.
2. Open `.env.local` in Notepad and fill in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`: from Part 1.
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: from Part 2.
   - `GEMINI_API_KEY`: your current Gemini key. `GEMINI_MODEL` stays `gemini-3.5-flash-lite`.
   - `NEXT_PUBLIC_CONTACT_EMAIL`: the contact address you want on the privacy page.
3. Generate three random secrets. Open PowerShell in `G:\Gmail Feature Integration\web` and run this command three times:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste the first result as `TOKEN_ENC_KEY`, the second as `AUTH_SECRET`, the third as `CRON_SECRET`.
4. Save the file.

## Part 4: run it locally
```powershell
cd "G:\Gmail Feature Integration\web"
```
```powershell
npm.cmd run dev
```
Open **http://localhost:3000**. You should see the Promise Keeper landing page. **/privacy** and **/data-deletion** also work.
