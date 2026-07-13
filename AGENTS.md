# ORA Hockey — Project Context

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
`teams`, `players`, `player_whitelist`, `games`, `training_sessions`, `attendance`, `polls`, `poll_options`, `poll_votes`, `player_stats`, `potm`, `match_team_lists`, `match_goals`, `match_cards`

Match results (goals/cards) are per-event rows: `match_goals` (scorer + assist slot `pc`/`ps`/player,
chronological via `goal_number`) and `match_cards` (green/yellow/red; `game_id NULL` = legacy card with
no match attribution). Any signed-in player can enter a played match's score (`set_match_score()` SQL fn,
derives `games.result`) and goal/card rows (player-write RLS). A trigger keeps `player_stats`
FG/PC/PS/assists in sync with goal rows — don't edit those columns directly for played games.

POTM: 1st/2nd/3rd placings per game in `potm` (shared places allowed); points 3/2/1 are
derived in `components/SeasonStats.tsx`, never stored. POTS race = season points tally.

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

## UI Preferences
- Stats inline in roster cards (not tables). Value+label together as "12G"
- No pill/badge backgrounds — plain text
- Card/sanction indicators use shapes: green ▲, yellow ■, red ● with count always shown (even 1)
- Mobile-first, compact, legible
- Sort: user row first, then alphabetical only (no position grouping)
- FG/PC/PS as separate columns not G total
- Position-based stat visibility: GK shows CS, outfield shows FG/PC/PS/A, both shows all
- Clean sheets derived from game score + GK attendance (not seed data)
- When Jeremy describes data columns/fields, he's clarifying DATA MAPPING, not requesting a UI redesign. Don't rebuild components — update data only. Ask before changing UI.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

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
