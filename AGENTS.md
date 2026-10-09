# ORA Hockey — Project Context

## What this is
Mobile-first team management web app for ORA Hockey (MHL1 league).
Two teams (~30–70 players total). Players use it on phones.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** — Postgres, Auth, RLS, Storage (project: `hvclbymllcqotvanbukx`)
- **Tailwind CSS** — dark "Liga" theme: grey/black surfaces, muted green `brand`, gold secondary accent
  (`tailwind.config.ts`); app styles are scoped under the `.liga-ui` class in `app/globals.css`
- **Vercel** — hosting (free tier)

## Roles
- **admin** (coach/manager): full CRUD — squad, schedule, team lists, polls, fines, invites, closing a season
- **player**: RSVP to games/trainings/events, vote in polls and POTM, enter a played match's score,
  goals and cards, and edit their own preferred name, date of birth and positions

Admins are players too: they RSVP and vote from the admin area. Auth is email/password via Supabase.
Role is stored in `players.role` (`admin` | `player`). `middleware.ts` handles route protection and
role-based redirects (admins are sent from `/dashboard` to `/admin` unless they switched to player view).

## Key files
```
app/
  login/                    Sign-in (client component)
  auth/callback/            Supabase PKCE code exchange
  auth/confirm/             Invite/reset link landing; button-gated so link previews can't use up the token
  auth/set-password/        Password setup after an invite or reset
  admin/                    Admin area: AdminShell + Home (dashboard/), Schedule, Polls, Squad (team/), Fines, Profile
  dashboard/                Player area: DashboardShell + the same six tabs
components/
  AppShell.tsx              Shared chrome for both areas: header, season switcher, bottom nav
  HomeView.tsx, FinesView.tsx, MyProfileView.tsx, PlayerProfileView.tsx
                            Server views rendered by both the admin and player routes
  EventDetailModal.tsx      Event details + admin edit (modal on touch, side panel on desktop)
  RosterList.tsx / RosterTable.tsx   Squad as cards (touch) / sortable table (desktop)
lib/
  supabase/                 client.ts (browser), server.ts (cookies), admin.ts (service role, server only),
                            fetch-all.ts (pages past the 1000-row API cap), request-user.ts (user forwarded by middleware)
  season.ts, season-server.ts   Season types/helpers + selected-season loaders
  stats.ts                  Derived stats (computeSeason): appearances, clean sheets, POTM points
  fines.ts, fines-server.ts Derived fines
  format.ts                 Dates in Singapore time
  preview.ts                getNow(): honours the admin preview date
middleware.ts               Auth guard, role routing, forwards the verified user on request headers
supabase/migrations/        001–032 — apply in filename order (prefixes 005 and 009 are each used twice)
supabase/seed/              Historical caps 2016–2025 and the 2026 season
tests/                      node:test suites (see Tests)
docs/                       User and admin manuals
```

## Database tables
`teams`, `players`, `player_whitelist`, `seasons`, `season_players`, `games`, `training_sessions`,
`team_events`, `opponents`, `attendance`, `attendance_log`, `polls`, `poll_options`, `poll_votes`,
`player_stats`, `potm`, `potm_polls`, `potm_ballots`, `potm_votes`, `match_team_lists`, `match_goals`,
`match_cards`, `fine_waivers`, `fine_payments`

Seasons (`011_seasons.sql`): `seasons` (label, dates, one `is_current`, `locked`) scopes
`games`/`training_sessions` via `season_id`; `season_players` is each season's squad with that
season's jersey number (positions live on `players`, across seasons). The selected season is the `ora-season` session cookie, read by
`lib/season-server.ts:getSelectedSeason()` (falls back to current); pages filter by it and the
header switcher (`components/SeasonSwitcher.tsx`) sets it. A `season_lock` BEFORE trigger on every
season-scoped table rejects app (JWT anon/authenticated) writes to a locked season — admins
included; SQL editor / service-role writes pass. `seasons` has no app write policies.
The one app path that writes `seasons` is `close_current_season()` (014, admin-checked definer fn)
behind the admin Home Danger zone (button → Yes → type CLOSE). Season phase (pre-season / season /
post-season) is derived from the season's fixtures + today in `lib/season.ts:seasonPhase()`, never stored.

Match results (goals/cards) are per-event rows: `match_goals` (scorer + assist slot `pc`/`ps`/player,
chronological via `goal_number`) and `match_cards` (green/yellow/red; `game_id NULL` = legacy card with
no match attribution). Any signed-in player can enter a played match's score (`set_match_score()` SQL fn,
derives `games.result`) and goal/card rows (player-write RLS). A trigger keeps `player_stats`
FG/PC/PS/assists in sync with goal rows — don't edit those columns directly for played games.

POTM: 1st/2nd/3rd placings per game in `potm` (shared places allowed); points 3/2/1 are
derived in `lib/stats.ts` (`computeSeason`), never stored. Players vote by secret ranked ballot
(`potm_polls`/`potm_ballots`); `cast_potm_vote()` and `close_potm_poll()` check eligibility,
auto-close and write the `potm` placings.

Polls (027): `poll_votes` is one row per picked option; players vote only through `set_poll_vote()`.

Fines (018–019) are derived, never stored (`lib/fines.ts` `computeFines`): from each entry's
`respond_by` + `fines_enabled`, the RSVP history (`attendance_log`), poll votes and admin waivers
(`fine_waivers`); `fine_payments` marks a fine paid.

Players: `cap_number` is the permanent debut order (#1 is the honorary cap for everyone before 2016,
#2 the first recorded debutant; 028–032) with `debut_game_id` (031). Players without an email yet are
"pending" (012). A BEFORE UPDATE guard (017/020) limits a player's self-edits to preferred name, date
of birth and positions; photos (`photo_path`, public `player-photos` bucket) are admin-written. Seasons record different stats (`seasons.recorded_stats`, 024) and
can be cancelled (`cancelled_reason`, 026 — 2020/2021 COVID).

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
SUPABASE_SERVICE_ROLE_KEY=...        # server only — invite/reset link generation
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # origin used in setup/reset links
NEXT_PUBLIC_DEV_LOGIN_EMAIL=...      # dev shortcut: typing admin/admin signs in as this account
NEXT_PUBLIC_DEV_LOGIN_PASSWORD=...   #   (development builds only)
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
2. Supabase → Authentication → URL Configuration must include the Vercel domain in Site URL and
   Redirect URLs (for the `/auth/callback` flow; invite/reset links go token_hash → `/auth/confirm`
   and are built from `NEXT_PUBLIC_SITE_URL`)

## Current state
- Live on Vercel; auto-deploys from `main`
- Schema: migrations 001–032 applied. The live DB has drifted from `001_initial_schema.sql` —
  `players.position` is `text[]` (FWD/MID/DEF/GK), `players.date_of_birth` added,
  `player_stats` has goals_fg/goals_pc/goals_ps (field goal / penalty corner / penalty stroke)
  with `goals` as a generated total, plus assists. Appearances (APP) are derived from attendance
  rows on played games, not stored. Clean sheets are derived too — GK attended a played game with
  goals_against = 0, computed in `lib/stats.ts` — the stored `player_stats.clean_sheet`
  column is legacy and no longer read
- Both areas have the same six tabs: Home, Schedule (games, trainings, team events + RSVP),
  Polls (incl. POTM voting), Squad (+ player profiles), Fines, Profile. Admin-only: adding/editing
  players, invites, scheduling, team lists, poll management, fine waivers/payments, closing a season
- Login: dev shortcut admin/admin maps to `NEXT_PUBLIC_DEV_LOGIN_*` in `.env.local`, dev builds only
- Seed data: historical caps 2016–2025 (2020/2021 cancelled) and the 2026 season, using the real roster
- Admin control panel: double-tap the ADMIN badge in the top bar — switch to player view
  (`ora-view` cookie, middleware bypass) or set a preview date (`ora-preview-date` cookie read
  by `lib/preview.ts:getNow()`; server pages pass `now` down to client components)

## Conventions
- Dates are stored timestamptz and always displayed in Singapore time via `lib/format.ts`
- Page pattern: server `page.tsx` fetches → passes to a `'use client'` component; mutations
  are server actions in a sibling `actions.ts` that `revalidatePath` affected routes
- Admin and player routes share one server view where they can (`components/*View.tsx`, e.g.
  `<HomeView basePath="/admin" />`); Schedule, Polls and Squad still have separate admin/player clients
- Use `getNow()` (not `new Date()`) for "now" in server pages, `getRequestUser()` for the signed-in
  user, and `fetchAll()` for any select that can pass 1000 rows
- Game `result` is derived from the score: `deriveResult()` when admins save a game,
  `set_match_score()` when anyone enters a played match's score

## Tests
```bash
node --test tests/*.test.cjs   # passing just tests/ fails to load
```
There's no `npm test` script. Many tests are source-pattern regexes on component markup, so UI
changes usually need test updates — run them before every commit.

## UI Preferences
- Squad: cards with stats inline on touch layouts ("12G", value+label together); a sortable
  table on desktop (lg+)
- No pill/badge backgrounds — plain text
- Card/sanction indicators use shapes: green ▲, yellow ■, red ● with count always shown (even 1)
- Mobile-first, compact, legible
- Sort: user row first, then alphabetical only (no position grouping)
- G and A lead; FG/PC/PS are a quieter breakdown of G
- Position-based stat visibility: GK shows CS, outfield shows G/A (+ FG/PC/PS), both shows all;
  APP for everyone; goals, goal types, assists, cards and POTM only where the season recorded them
- Clean sheets derived from game score + GK attendance (not seed data)
- When Jeremy describes data columns/fields, he's clarifying DATA MAPPING, not requesting a UI redesign. Don't rebuild components — update data only. Ask before changing UI.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

When a graph tool accepts `repo_root`, pass this repository's absolute root
explicitly. Hermes uses one shared MCP server for several repositories; relying
on the server process's working directory can query the wrong project.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
