# ORA Hockey Team App

<img src="public/crest.png" alt="ORA Hockey Crest" width="20%" />

A mobile-first team management app for ORA Hockey (MHL1 league), covering rosters, games, training, attendance, match results, season stats, and polls.

## Documentation

- [User manual](docs/user-manual.md): account setup and everyday player tasks.
- [Admin manual](docs/admin-manual.md): roster management, invitations, scheduling, and polls.
- [Project context and contributor conventions](AGENTS.md): architecture, data rules, and repository workflow.

## Stack

| Area | Technology |
| --- | --- |
| Application | Next.js 14.2.18, App Router |
| UI | React 18, TypeScript 5, Tailwind CSS 3 |
| Backend | Supabase Postgres, Auth, and row-level security (RLS) |
| Supabase clients | `@supabase/supabase-js`, `@supabase/ssr` |
| Hosting | Vercel |

## Quick start

### Prerequisites

- Node.js 18.17 or later (Next.js 14 minimum); use a maintained Node.js release.
- npm and Git.
- Access to a configured development Supabase project and a roster-linked test account.

### Clone and install

```bash
git clone https://github.com/jeremyyeh11/orahockey-app.git
cd orahockey-app
npm ci
```

### Configure the environment

Create `.env.local` in the repository root:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by browser and server clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key; keep this variable name because the app reads it directly. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key needed for admin invite and password reset link generation. |
| `NEXT_PUBLIC_SITE_URL` | Origin used when building setup/reset links; use your deployment's origin outside local development. |

`.env.local` is gitignored. Keep service-role keys server-only; variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with a test account linked to a `players` row. Its `role` determines whether you enter the player or admin area. New player accounts are created through the admin invitation workflow described in the [admin manual](docs/admin-manual.md).

## Database setup

SQL migrations are in [supabase/migrations](supabase/migrations); season data is in [supabase/seed](supabase/seed). The app relies on the later migrations as well as the initial schema, including match results, POTM voting, security hardening, and onboarding.

For an existing development project, confirm its schema matches the app before running it. For a fresh project, review and apply the SQL migration files in filename order using the Supabase SQL Editor, checking each file's prerequisites. Two migration prefixes are duplicated (`005` and `009`), so do not assume this directory is ready for an unattended Supabase CLI migration workflow.

[AGENTS.md](AGENTS.md) records known differences between the live database and the initial schema. The initial schema alone is not a complete current database snapshot. The 2026 seed contains real club roster and season data; inspect it before choosing to load it into a development database.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm test` | Run the test suites in `tests/` (Node's built-in test runner). |
| `npm run lint` | Run Next.js ESLint checks (`next/core-web-vitals`); `npm run build` also lints and fails on errors. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build after building. |

## Project structure

```text
app/
  login/                Email/password sign-in
  auth/                 Callback, invite/reset confirmation, password setup
  admin/                Coach/manager pages and server actions
  dashboard/            Player pages and server actions
components/             Shared UI, event details, match results, roster, stats
lib/
  supabase/             Browser, server, and privileged admin clients
  format.ts             Date/time formatting
  stats.ts              Derived season statistics
middleware.ts           Route protection and role-based routing
supabase/
  migrations/           Schema, functions, triggers, and RLS policies
  seed/                 Season seed data
public/                 Crest, player images, and app icons
docs/                   User and admin manuals
```

## Development conventions

- Server `page.tsx` files fetch data and pass it to client components; mutations use server actions and revalidate affected routes.
- Roles are stored in `players.role` (`admin` or `player`); database RLS policies enforce data access.
- Store dates as `timestamptz` and display them in Singapore time through `lib/format.ts`.
- Match goal rows drive goal and assist totals through database triggers. Caps and goalkeeper clean sheets are derived from played games and attendance. See [AGENTS.md](AGENTS.md) before changing stat calculations.

Create a working branch for changes, run the checks relevant to your changes, and commit and push that branch for review.

## Deployment

The project is hosted on Vercel, with automatic deployment on pushes to `main`. Configure the environment variables above in the relevant Vercel environments, with `NEXT_PUBLIC_SITE_URL` set to the correct app origin. Configure the deployed domain in Supabase Authentication's Site URL and Redirect URLs for the authentication callback flow.

The admin manual covers account operations in the app; application hosting and database configuration belong to the developer setup above.
