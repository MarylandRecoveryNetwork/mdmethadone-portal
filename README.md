# Maryland Methadone Finder
### mdmethadone.help

Real-time directory of Maryland methadone clinics / opioid treatment programs (OTPs),
showing which clinics are **accepting new patients** today.

Built the same way as mdaddiction.help (MABT), but simpler: instead of bed counts,
each clinic shows one of three statuses — **Accepting / Waitlist / Not accepting**.

## Stack
- **Next.js 15** (App Router) — deployed on Vercel
- **Supabase** — PostgreSQL + Auth
- **TypeScript**

## Routes
| Path | Description |
|------|-------------|
| `/` | Redirects to `/find-clinic` |
| `/find-clinic` | Public clinic finder (map + table + filters) |
| `/login` | Email/password + Google/Microsoft OAuth |
| `/portal/dashboard` | Clinic manager — update accepting status |
| `/admin/dashboard` | Admin — clinics, audit log, users |

## Status model
Each clinic has one row in `clinic_status`:
- `accepting` — taking new patients now (green)
- `waitlist` — adding to a waitlist, optional note (gold)
- `not_accepting` — not taking new patients (red)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://www.mdmethadone.help
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Where the clinic data lives
- **Static directory** (names, addresses, services): the `CLINICS` array in
  [`public/tracker/index.html`](public/tracker/index.html). Paste your Gemini data there.
- **Live status** (accepting/waitlist): the `clinics` + `clinic_status` tables in Supabase.
  Matched to the static directory by `slug`.

## First-time setup
See **[SETUP.md](SETUP.md)** for the full GitHub → Supabase → Vercel walkthrough.

## Database
Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL editor.

## Deploy
Push to GitHub → Vercel auto-deploys on every commit to `main`.
