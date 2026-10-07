-- =============================================================
-- ORA Hockey — Team events (gatherings, meetings, …)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- A third kind of schedule entry next to games and trainings: a titled event
-- (e.g. "Team dinner", "AGM"). Season-scoped like the others, RSVP-able
-- (attendance.session_type 'event'), and covered by the archived-season lock.
--
-- Re-run safe.
-- =============================================================

alter type public.session_type add value if not exists 'event';

create table if not exists public.team_events (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams(id) on delete set null,
  season_id   uuid not null references public.seasons(id) on delete restrict,
  title       text not null check (btrim(title) <> ''),
  event_date  timestamptz not null,
  location    text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists team_events_season on public.team_events (season_id, event_date);

alter table public.team_events enable row level security;
drop policy if exists "Signed-in users can view team_events" on public.team_events;
create policy "Signed-in users can view team_events" on public.team_events
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage team_events" on public.team_events;
create policy "Admins manage team_events" on public.team_events
  for all using (is_admin()) with check (is_admin());

-- Default season for writers that don't pass one: also reads event_date
create or replace function public.assign_default_season()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d   date;
  sid uuid;
begin
  if new.season_id is null then
    d := coalesce(
      to_jsonb(new)->>'game_date', to_jsonb(new)->>'session_date', to_jsonb(new)->>'event_date'
    )::timestamptz::date;
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

drop trigger if exists season_assign_default on public.team_events;
create trigger season_assign_default before insert on public.team_events
  for each row execute function public.assign_default_season();

-- The season a row belongs to — now also team_events and event RSVPs
create or replace function public.season_id_for(p_table text, p_row jsonb)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid;
begin
  case p_table
    when 'games', 'training_sessions', 'season_players', 'team_events' then
      sid := (p_row->>'season_id')::uuid;
    when 'match_goals', 'match_cards', 'match_team_lists', 'player_stats', 'potm', 'potm_polls' then
      if p_row->>'game_id' is null then
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
      elsif p_row->>'session_type' = 'event' then
        select season_id into sid from team_events where id = (p_row->>'session_id')::uuid;
      else
        select season_id into sid from training_sessions where id = (p_row->>'session_id')::uuid;
      end if;
    else
      sid := null;
  end case;
  return sid;
end;
$$;

drop trigger if exists season_lock on public.team_events;
create trigger season_lock before insert or update or delete on public.team_events
  for each row execute function public.enforce_season_lock();

revoke execute on function public.assign_default_season() from public, anon, authenticated;
revoke execute on function public.season_id_for(text, jsonb) from public, anon, authenticated;
