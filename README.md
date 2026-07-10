# ORA Hockey — MHL1 Team Management App

<img src="public/crest.png" alt="ORA Hockey Crest" width="20%" />

Mobile-first team management portal for ORA Hockey (MHL1).  
Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase.

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.local` (already included) or create it manually:

```
NEXT_PUBLIC_SUPABASE_URL=https://hvclbymllcqotvanbukx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to `/login`.

---

## Apply the Database Schema

1. Open your [Supabase Dashboard](https://app.supabase.com/)
2. Select the **orahockey** project
3. Go to **SQL Editor** → **New query**
4. Paste the contents of `supabase/migrations/001_initial_schema.sql`
5. Click **Run**

This creates all tables with RLS policies, enums, indexes, and the `is_admin()` helper function.

---

## Seed Your First Admin

After applying the schema, create your first admin user:

1. **Supabase Dashboard → Authentication → Users → Invite user** (or use email/password signup)
2. Copy the new user's UUID from the Auth users list
3. In SQL Editor, run:

```sql
insert into players (auth_user_id, full_name, email, role)
values ('<auth-user-uuid>', 'Your Name', 'you@example.com', 'admin');
```

Now sign in at `/login` — middleware will route you to `/admin/dashboard`.

---

## Project Structure

```
app/
  login/            # Email + password login
  auth/callback/    # Supabase PKCE callback
  admin/            # Admin shell + pages (Dashboard, Team, Schedule, Stats, Polls)
  dashboard/        # Player shell + pages (Home, Schedule, Polls, Stats)
lib/supabase/
  client.ts         # Browser Supabase client
  server.ts         # Server-side Supabase client (SSR / cookies)
middleware.ts       # Auth guard + role-based routing
supabase/
  migrations/       # SQL migration files
```

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import repo
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**

Vercel auto-detects Next.js — no extra configuration needed.

---

## Auth Flow

```
/login  →  signInWithPassword  →  check players.role
                                   ├─ admin  → /admin/dashboard
                                   └─ player → /dashboard
```

Middleware protects all `/dashboard` and `/admin` routes.  
Unauthenticated requests are redirected to `/login`.  
Players accessing `/admin` (or admins accessing `/dashboard`) are silently rerouted.
