-- =============================================================
-- ORA Hockey — Seasons
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Until now a "season" was just the year of a game's date. This makes it a
-- real record that scopes the schedule, the squad and season stats:
--
--   seasons          one row per season (label '2027'); exactly one is_current;
--                    `locked` makes a season read-only to the app.
--   season_players   the squad for a season, with that season's jersey/position.
--   games.season_id / training_sessions.season_id
--
-- Locked seasons are immutable from the app — admins included. A BEFORE
-- trigger on every season-scoped table rejects writes that come in through
-- the API (JWT role anon/authenticated). Backend paths are let through: the
-- SQL editor / MCP / migrations (no JWT) and the service-role key. Locking and
-- unlocking happen only from the backend: `seasons` has no write policies.
--
-- Re-run safe: guarded DDL, `on conflict do nothing` seeds.
-- =============================================================

-- ── 1. Tables ─────────────────────────────────────────────────
create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index if not exists seasons_one_current on public.seasons (is_current) where is_current;

create table if not exists public.season_players (
  season_id      uuid not null references public.seasons(id) on delete restrict,
  player_id      uuid not null references public.players(id) on delete cascade,
  jersey_number  smallint,
  position       text[],
  created_at     timestamptz not null default now(),
  primary key (season_id, player_id)
);
create index if not exists season_players_player on public.season_players (player_id);

alter table public.games             add column if not exists season_id uuid references public.seasons(id) on delete restrict;
alter table public.training_sessions add column if not exists season_id uuid references public.seasons(id) on delete restrict;
create index if not exists games_season on public.games (season_id);
create index if not exists training_sessions_season on public.training_sessions (season_id);

-- ── 2. Seed seasons + backfill ────────────────────────────────
insert into public.seasons (label, starts_on, ends_on, is_current, locked) values
  ('2026', '2026-01-01', '2026-12-31', false, true),
  ('2027', '2027-01-01', '2027-12-31', true,  false)
on conflict (label) do nothing;

update public.games g set season_id = s.id
  from public.seasons s
  where g.season_id is null and g.game_date::date between s.starts_on and s.ends_on;
update public.training_sessions t set season_id = s.id
  from public.seasons s
  where t.season_id is null and t.session_date::date between s.starts_on and s.ends_on;

-- 2026 squad: everyone on the books (all 28 played or were active in 2026)
insert into public.season_players (season_id, player_id, jersey_number, position)
select s.id, p.id, p.jersey_number, p.position
from public.seasons s cross join public.players p
where s.label = '2026'
on conflict do nothing;

-- 2027 squad starts as the active 2026 players
insert into public.season_players (season_id, player_id, jersey_number, position)
select s.id, p.id, p.jersey_number, p.position
from public.seasons s cross join public.players p
where s.label = '2027' and p.is_active
on conflict do nothing;

alter table public.games             alter column season_id set not null;
alter table public.training_sessions alter column season_id set not null;

-- ── 3. RLS ────────────────────────────────────────────────────
alter table public.seasons enable row level security;
alter table public.season_players enable row level security;

drop policy if exists "Signed-in users can view seasons" on public.seasons;
create policy "Signed-in users can view seasons" on public.seasons
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policies on seasons: creating, switching and
-- locking seasons is backend-only.

drop policy if exists "Signed-in users can view season_players" on public.season_players;
create policy "Signed-in users can view season_players" on public.season_players
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage season_players" on public.season_players;
create policy "Admins manage season_players" on public.season_players
  for all using (is_admin()) with check (is_admin());

-- ── 4. Default season for new games / trainings ───────────────
-- The app passes season_id explicitly. This fills it for any writer that
-- doesn't (older deployments): the open season covering the date, else the
-- current season.
create or replace function public.assign_default_season()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d   date;
  sid uuid;
begin
  if new.season_id is null then
    d := coalesce(to_jsonb(new)->>'game_date', to_jsonb(new)->>'session_date')::timestamptz::date;
    select id into sid from seasons
      where not locked and d between starts_on and ends_on
      order by starts_on desc limit 1;
    if sid is null then
      select id into sid from seasons where is_current;
    end if;
    new.season_id := sid;
  end if;
  return new;
end;
$$;

drop trigger if exists season_assign_default on public.games;
create trigger season_assign_default before insert on public.games
  for each row execute function public.assign_default_season();
drop trigger if exists season_assign_default on public.training_sessions;
create trigger season_assign_default before insert on public.training_sessions
  for each row execute function public.assign_default_season();

-- New players join the current season's squad
create or replace function public.add_player_to_current_season()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into season_players (season_id, player_id, jersey_number, position)
  select id, new.id, new.jersey_number, new.position from seasons where is_current
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists players_join_current_season on public.players;
create trigger players_join_current_season after insert on public.players
  for each row execute function public.add_player_to_current_season();

-- ── 5. Lock enforcement ───────────────────────────────────────
-- True for backend writers: no JWT (SQL editor / MCP / migrations) or the
-- service-role key. App requests always carry anon/authenticated.
create or replace function public.season_lock_bypassed()
returns boolean language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) not in ('anon', 'authenticated')
$$;

-- The season a row of a season-scoped table belongs to
create or replace function public.season_id_for(p_table text, p_row jsonb)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid;
begin
  case p_table
    when 'games', 'training_sessions', 'season_players' then
      sid := (p_row->>'season_id')::uuid;
    when 'match_goals', 'match_cards', 'match_team_lists', 'player_stats', 'potm', 'potm_polls' then
      if p_row->>'game_id' is null then
        -- Legacy match_cards rows (no game): the season covering created_at
        select id into sid from seasons
          where (p_row->>'created_at')::timestamptz::date between starts_on and ends_on
          order by starts_on desc limit 1;
      else
        select season_id into sid from games where id = (p_row->>'game_id')::uuid;
      end if;
    when 'potm_votes', 'potm_ballots' then
      select g.season_id into sid
        from potm_polls pp join games g on g.id = pp.game_id
        where pp.id = (p_row->>'poll_id')::uuid;
    when 'attendance' then
      if p_row->>'session_type' = 'game' then
        select season_id into sid from games where id = (p_row->>'session_id')::uuid;
      else
        select season_id into sid from training_sessions where id = (p_row->>'session_id')::uuid;
      end if;
    else
      sid := null;
  end case;
  return sid;
end;
$$;

create or replace function public.enforce_season_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lbl text;
begin
  if public.season_lock_bypassed() then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select label into lbl from seasons
      where locked and id = public.season_id_for(tg_table_name, to_jsonb(old));
  end if;
  if lbl is null and tg_op in ('INSERT', 'UPDATE') then
    select label into lbl from seasons
      where locked and id = public.season_id_for(tg_table_name, to_jsonb(new));
  end if;

  if lbl is not null then
    raise exception 'Season % is locked — past seasons are read-only.', lbl
      using errcode = 'P0001', hint = 'Changes to a locked season can only be made from the backend.';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'games', 'training_sessions', 'season_players', 'attendance',
    'match_goals', 'match_cards', 'match_team_lists', 'player_stats',
    'potm', 'potm_polls', 'potm_votes', 'potm_ballots'
  ] loop
    execute format('drop trigger if exists season_lock on public.%I', t);
    execute format(
      'create trigger season_lock before insert or update or delete on public.%I
         for each row execute function public.enforce_season_lock()', t);
  end loop;
end;
$$;

-- POTM polls are created lazily on page load; never for a locked season
-- (the insert would now raise and break the page).
create or replace function public.ensure_potm_polls()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into potm_polls (game_id)
  select g.id
  from games g
  join seasons s on s.id = g.season_id and not s.locked
  where g.game_date <= now()
    and g.team_list_status = 'published'
    and exists (select 1 from match_team_lists m where m.game_id = g.id)
    and not exists (select 1 from potm_polls p where p.game_id = g.id)
    and not exists (select 1 from potm pt where pt.game_id = g.id)
  on conflict (game_id) do nothing;
end;
$$;

-- ── 6. Grants — internal helpers have no REST caller ──────────
revoke execute on function public.assign_default_season()          from public, anon, authenticated;
revoke execute on function public.add_player_to_current_season()   from public, anon, authenticated;
revoke execute on function public.season_id_for(text, jsonb)       from public, anon, authenticated;
revoke execute on function public.enforce_season_lock()            from public, anon, authenticated;
revoke execute on function public.ensure_potm_polls()              from public, anon;
grant  execute on function public.ensure_potm_polls()              to authenticated;
