# marylandmethadone.help — Full Setup Walkthrough

This walks you through standing up the new site on **GitHub**, **Supabase**, and **Vercel** —
the same three services as mdaddiction.help. Use the **same logins** for each service; you're
just creating **separate projects** so the two sites never touch each other's data.

> Mental model: GitHub stores the code → Vercel turns the code into the live website →
> Supabase is the database the website reads/writes.

Work top to bottom. Each part says exactly what to click.

---

## Part 0 — One-time tools on your PC (5 min)

You only need this if you want to run/test the site locally before deploying. You *can* skip
straight to Part 1 and let Vercel build it, but installing these makes life easier.

1. **Node.js** — download the "LTS" installer from <https://nodejs.org> and run it (click Next through).
2. **Git** — download from <https://git-scm.com/download/win> and run it (defaults are fine).
3. Reboot your terminal, then in PowerShell:
   ```powershell
   cd "C:\Users\House Guest\Downloads\mdmethadone-portal"
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>. You'll see the finder with the two sample clinics
   ("status unknown" until Supabase is connected). Press `Ctrl+C` to stop.

---

## Part 1 — GitHub (create the repo, same account) (10 min)

1. Go to <https://github.com> and sign in with your **existing** account.
2. Click the **+** (top-right) → **New repository**.
   - **Repository name:** `mdmethadone-portal`
   - **Private** (recommended)
   - Do **not** add a README/.gitignore (we already have them).
   - Click **Create repository**.
3. Leave that page open — it shows a URL like
   `https://github.com/YOURNAME/mdmethadone-portal.git`. You'll need it.
4. Push your local code up. In PowerShell:
   ```powershell
   cd "C:\Users\House Guest\Downloads\mdmethadone-portal"
   git init
   git add .
   git commit -m "Initial commit — marylandmethadone.help"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/mdmethadone-portal.git
   git push -u origin main
   ```
   If GitHub asks you to authenticate, a browser window will pop up — sign in to approve.
5. Refresh the GitHub page; your files should appear.

> ✅ `.env.local` is in `.gitignore`, so your secret keys are **not** uploaded. Good.

---

## Part 2 — Supabase (new project, same account) (20 min)

### 2a. Create the project
1. Go to <https://supabase.com/dashboard> and sign in with your **existing** account.
2. Click **New project**.
   - **Name:** `mdmethadone`
   - **Database password:** click *Generate*, then **save it** in your password manager.
   - **Region:** `East US (North Virginia)` (closest to Maryland).
   - Click **Create new project** and wait ~2 minutes for it to provision.

### 2b. Create the tables
1. Left sidebar → **SQL Editor** → **New query**.
2. Open the file `supabase/schema.sql` from this project, copy **everything**, paste it in.
3. Click **Run**. You should see "Success. No rows returned."
   (This creates the `clinics`, `clinic_status`, `profiles`, `audit_logs` tables, the public
   view, and all the security rules.)

### 2c. Grab your API keys
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy these two values — you'll paste them in several places below:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon / public key** (under "Project API keys")
3. Click **reveal** on the **service_role** key and copy it too. **This one is secret** — it
   goes only in `.env.local` and in Vercel (never in the browser code).

### 2d. Tell Supabase where the site lives (auth redirect URLs)
1. Left sidebar → **Authentication** → **URL Configuration**.
2. **Site URL:** `https://www.marylandmethadone.help`
3. **Redirect URLs** — add each of these (click *Add URL* for each):
   - `https://www.marylandmethadone.help/auth/callback`
   - `https://marylandmethadone.help/auth/callback`
   - `http://localhost:3000/auth/callback` (for local testing)
4. Click **Save**.

### 2e. (Optional) Google / Microsoft login
If you want staff to sign in with Google/Microsoft (same as the other site):
- **Authentication → Providers → Google** (or Azure) → enable, paste the client ID/secret.
- This is optional. Email/password works without it. You can do it later.

---

## Part 3 — Put your keys into the code (5 min)

There are **three** spots to fill in. Use Find & Replace in your editor for `YOUR_PROJECT_REF`
and `YOUR_ANON_OR_PUBLISHABLE_KEY`.

1. **`.env.local`** (already created for you) — replace the placeholders:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your anon key...
   NEXT_PUBLIC_SITE_URL=https://www.marylandmethadone.help
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your service_role key...
   ```
2. **`public/tracker/index.html`** — near the bottom, the `SUPABASE_URL` and `SUPABASE_ANON`
   constants. (The public finder reads live status directly, so it needs the URL + anon key.
   Never put the service_role key here.)
3. **`next.config.ts`** — change the `hostname` to your `abcdefgh.supabase.co`.

Commit and push the two non-secret changes (`index.html`, `next.config.ts`):
```powershell
git add public/tracker/index.html next.config.ts
git commit -m "Wire Supabase project"
git push
```

---

## Part 4 — Vercel (new project, same account) (10 min)

1. Go to <https://vercel.com/dashboard> and sign in with your **existing** account
   (use "Continue with GitHub" so it can see your repos).
2. Click **Add New… → Project**.
3. Find `mdmethadone-portal` in the list → **Import**.
4. Vercel auto-detects Next.js. Before clicking Deploy, expand **Environment Variables** and add
   all four (Name → Value), matching your `.env.local`:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.marylandmethadone.help` |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
5. Click **Deploy**. Wait ~2 min. You'll get a temporary URL like
   `mdmethadone-portal.vercel.app` — open it to confirm it loads.

---

## Part 5 — Connect the domain you bought (10 min + DNS wait)

1. In Vercel → your project → **Settings → Domains**.
2. Type `marylandmethadone.help` → **Add**. Then add `www.marylandmethadone.help` too and set the **www**
   one as primary (or redirect — Vercel will offer this).
3. Vercel shows the DNS records you need. Go to wherever you **bought the domain** (the
   registrar), open its DNS settings, and add what Vercel tells you — usually:
   - An **A record** for `@` → `76.76.21.21`
   - A **CNAME** for `www` → `cname.vercel-dns.com`
   (Vercel shows the exact values; copy theirs, not these, if different.)
4. Save at the registrar. DNS can take 10 minutes to a few hours. Vercel auto-issues HTTPS once
   it sees the records (a green check appears).

---

## Part 6 — Create your admin login (5 min)

1. Visit `https://www.marylandmethadone.help/login` (or the vercel.app URL) → **Register** tab.
   Sign up with your email + a password. You'll see "pending activation."
2. In Supabase → **Authentication → Users**, confirm your user is listed (copy nothing — just confirm).
3. In Supabase → **SQL Editor → New query**, run this (replace the email):
   ```sql
   update public.profiles
   set role = 'global_admin', is_active = true
   where email = 'you@youremail.com';
   ```
4. Go back to `/login`, sign in. You should land on the **Admin Dashboard**.

---

## Part 7 — Your clinics (already loaded ✅)

Your 102 Maryland OTPs from `maryland_methadone_clinics_master.csv` are **already imported**.
A transform script (`scripts/build-clinics.mjs`) generated both halves, matched by a unique `slug`:

**A. The map/table directory** → already written into the `CLINICS` array in
   `public/tracker/index.html`. Each clinic has county, region, and approximate map coordinates.

**B. The database import file** → `supabase/clinics-import.csv` (ready to upload).
   In Supabase: **Table Editor → `clinics` → Insert → Import data from CSV** → pick that file.
   A `clinic_status` row is auto-created for each clinic (defaults to "accepting").
   Same `slug` values as the directory, so live status lines up automatically.

### What I assumed (please verify / adjust)
The source CSV only had name, address, phone, and certification — so I applied defaults:
- `offers_methadone = true` for all (they're SAMHSA-certified OTPs).
- `offers_buprenorphine`, `offers_naltrexone` = **false** (unknown from source).
- `accepts_medicaid = true` (MD Medicaid covers OTP care); all other payment fields = **false**.
- `is_verified = true` for "Certified" programs, false for "Provisional".
- **4 correctional/detention programs were excluded** from the public finder
  (Metropolitan Transition Center, Baltimore Central Booking, Jessup Correctional,
  Baltimore City Women's Detention). To include them, delete the `EXCLUDE` line in the script and re-run.

Clinics (or you, as admin) can correct medication/payment flags anytime via the portal or
Supabase. Map pins are **city-level approximate**; to get exact pin placement later, geocode the
street addresses and update each clinic's `lat`/`lng`.

### To re-run the transform (if your source CSV changes)
```powershell
node scripts/build-clinics.mjs
```

After any change to `index.html`, push it:
```powershell
git add public/tracker/index.html supabase/clinics-import.csv
git commit -m "Update clinic directory"
git push
```
Vercel redeploys automatically.

---

## Part 8 — Add a clinic manager (optional, ongoing)

When a clinic wants to update its own status:
1. They register at `/login`.
2. You run, in Supabase SQL Editor (get the clinic's id from the `clinics` table):
   ```sql
   update public.profiles
   set role = 'clinic_manager', is_active = true,
       clinic_id = 'PASTE-CLINIC-UUID-HERE'
   where email = 'manager@theirclinic.org';
   ```
3. They log in and see a one-screen dashboard with three big buttons:
   **Accepting / Waitlist / Not accepting** → Publish.

---

## How the two clinic lists stay in sync

- The **table & map** come from `index.html` (`CLINICS`).
- The **green/gold/red status** comes from Supabase (`clinic_status`), matched by `slug`.
- So the rule is: **every clinic's `slug` must be identical** in both places. If a clinic shows
  "status unknown," its slug doesn't match a database row (or no status was published yet).

---

## Quick troubleshooting
- **Everything shows "status unknown"** → the `SUPABASE_URL`/`SUPABASE_ANON` in `index.html`
  are still placeholders, or slugs don't match between `index.html` and the `clinics` table.
- **Login says "pending activation" forever** → you didn't run the `is_active = true` SQL (Part 6).
- **OAuth fails** → redirect URL missing in Supabase (Part 2d) or provider not enabled (Part 2e).
- **Vercel build fails** → an env var is missing/misspelled (Part 4 step 4).
- **Map is blank** → clinics have no `lat`/`lng`; add coordinates.

---

## Recap of what's separate vs. shared
| | mdaddiction.help | marylandmethadone.help |
|--|--|--|
| GitHub account | same | **same** |
| GitHub repo | mabt-full | **mdmethadone-portal** (new) |
| Vercel account | same | **same** |
| Vercel project | (existing) | **mdmethadone-portal** (new) |
| Supabase account | same | **same** |
| Supabase project | qcxquthjeboizuzencqk | **new project** |
| Domain | mdaddiction.help | **marylandmethadone.help** |

Nothing is shared at the data level — separate Supabase projects mean separate databases,
separate users, separate everything. Only your *logins* to the three services are reused.
