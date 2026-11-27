-- =============================================================
-- ORA Hockey — First-time tour and What's new
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 044
-- =============================================================
--
-- One row per player who has an account: whether they've been through the
-- first-time tour and the newest What's new release they've seen
-- (lib/whats-new.ts ids). No row = a new account: the app shows the tour.
--
-- Each player reads and writes only their own row. A separate table so the
-- players self-edit guard (017/020/043) stays as it is.
--
-- Existing accounts are backfilled with a row (tour not done, nothing seen):
-- they get the What's new modal, which offers the tour, instead of the tour
-- itself. Additive: older app code never reads the table. Re-run safe.
-- =============================================================

create table if not exists public.player_onboarding (
  player_id     uuid primary key references public.players(id) on delete cascade,
  tour_done_at  timestamptz,
  seen_release  text,
  updated_at    timestamptz not null default now()
);

alter table public.player_onboarding enable row level security;

drop policy if exists "Players read own onboarding" on public.player_onboarding;
create policy "Players read own onboarding" on public.player_onboarding
  for select using (player_id = (select id from public.players where auth_user_id = auth.uid()));

drop policy if exists "Players insert own onboarding" on public.player_onboarding;
create policy "Players insert own onboarding" on public.player_onboarding
  for insert with check (player_id = (select id from public.players where auth_user_id = auth.uid()));

drop policy if exists "Players update own onboarding" on public.player_onboarding;
create policy "Players update own onboarding" on public.player_onboarding
  for update using (player_id = (select id from public.players where auth_user_id = auth.uid()))
  with check (player_id = (select id from public.players where auth_user_id = auth.uid()));

-- Accounts that exist at launch: What's new (with "Take the tour"), not the tour.
-- Only on the first run (empty table), so a re-run never takes the tour from
-- accounts made since.
insert into public.player_onboarding (player_id)
select id from public.players
where auth_user_id is not null
  and not exists (select 1 from public.player_onboarding)
on conflict (player_id) do nothing;
