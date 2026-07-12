# ORA Hockey — Project Context for Claude

## What this is
Mobile-first team management web app for ORA Hockey (MHL1 league).
Two teams (~30–70 players total). Players use it on phones.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** — Postgres, Auth, RLS (project: `hvclbymllcqotvanbukx`)
- **Tailwind CSS** — custom dark theme (slate-900 bg, blue-700 brand)
- **Vercel** — hosting (free tier)

## Roles
- **admin** (coach/manager): full CRUD on everything
- **player**: read-only + can mark attendance + vote in polls

Auth is email/password via Supabase. Role is stored in `players.role` (enum: `admin` | `player`). Middleware at `middleware.ts` handles route protection and role-based redirects.

## Key files
```
app/login/           # Login page (client component)
app/auth/callback/   # Supabase PKCE callback
app/admin/           # Admin shell + Dashboard, Team, Schedule, Stats, Polls pages
app/dashboard/       # Player shell + Home, Schedule, Polls, Stats pages
lib/supabase/
  client.ts          # Browser client (createBrowserClient)
  server.ts          # Server client (createServerClient + cookies)
middleware.ts        # Auth guard + role routing
supabase/migrations/
  001_initial_schema.sql  # Full schema — run in Supabase SQL Editor
```

## Database tables
`teams`, `players`, `player_whitelist`, `games`, `training_sessions`, `attendance`, `polls`, `poll_options`, `poll_votes`, `player_stats`

All tables have RLS enabled. `is_admin()` SQL function used in policies.

## Local dev
```bash
npm install
npm run dev   # http://localhost:3000
```

Env vars in `.env.local` (gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://hvclbymllcqotvanbukx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_LuLhf_qZ_OVExwuwv74lmg_YZ3C2XWW
```

## Git workflow
**Always commit and push after every code change** — Vercel auto-deploys on push to main.
```bash
git add <changed files>
git commit -m "description of change"
git push
```
Do not skip this step. Every session that modifies code must end with a commit + push.

## Deployment (Vercel)
1. Env vars must be added manually in Vercel project settings (they're gitignored)
2. Supabase → Authentication → URL Configuration must include the Vercel domain in Site URL and Redirect URLs

## Current state
- Schema and migrations: ✅ done (note: live DB has drifted from `001_initial_schema.sql` —
  `players.position` is now `text[]` (FWD/MID/DEF/GK), `players.date_of_birth` added,
  `player_stats` has goals_fg/goals_pc/goals_ps (field goal / penalty corner / penalty stroke)
  with `goals` as a generated total, plus assists/clean_sheet; Caps are derived from
  attendance rows on played games, not stored)
- Auth + middleware: ✅ done
- Login page: ✅ done (dev shortcut: admin/admin maps to `NEXT_PUBLIC_DEV_LOGIN_*` in `.env.local`, dev builds only)
- Admin pages: ✅ built (Dashboard, Team, Schedule, Stats, Polls, Profile)
- Player pages: ✅ built (Home, Team roster, Schedule + attendance, Stats, Polls + voting)
- Admins are players too: admin Schedule has own-attendance buttons, admin Polls has voting
- Seed data: ✅ 2026 season backlog seeded (`supabase/seed/2026_season.sql`) — 14 played games,
  20 trainings, attendance, stats, polls, using the real 24-player roster
- Admin control panel: ✅ double-tap the ADMIN badge in the top bar — switch to player view
  (`ora-view` cookie, middleware bypass) or set a preview date (`ora-preview-date` cookie read
  by `lib/preview.ts:getNow()`; server pages pass `now` down to client components)
- Deployment: ⚠️ in progress

## Conventions
- Dates are stored timestamptz and always displayed in Singapore time via `lib/format.ts`
- Page pattern: server `page.tsx` fetches → passes to a `'use client'` component; mutations
  are server actions in a sibling `actions.ts` that `revalidatePath` affected routes
- Game `result` is derived from the score (win/loss/tie) when saving in admin Schedule
