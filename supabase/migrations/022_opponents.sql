-- =============================================================
-- ORA Hockey — Opponent full names; Saints = SAA
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- games.opponent stays the short name used in titles ("ORA vs SAA").
-- opponents maps a short name to the club's full name, shown in the game
-- details as "St Andrew's Alumni (SAA)". Short names without a row just
-- show as they are.
--
-- Also merges "Saints" (the 2025 import) into SAA — same club. Run as the
-- database owner, so the archived-season lock doesn't apply.
--
-- Re-run safe.
-- =============================================================

create table if not exists public.opponents (
  short_name text primary key check (btrim(short_name) <> ''),
  full_name  text not null check (btrim(full_name) <> '')
);

alter table public.opponents enable row level security;
drop policy if exists "Signed-in users can view opponents" on public.opponents;
create policy "Signed-in users can view opponents" on public.opponents
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage opponents" on public.opponents;
create policy "Admins manage opponents" on public.opponents
  for all using (is_admin()) with check (is_admin());

insert into public.opponents (short_name, full_name) values
  ('SAA', 'St Andrew''s Alumni'),
  ('SCC', 'Singapore Cricket Club')
on conflict (short_name) do update set full_name = excluded.full_name;

update public.games set opponent = 'SAA' where opponent = 'Saints';
