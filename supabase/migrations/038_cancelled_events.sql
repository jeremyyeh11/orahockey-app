-- =============================================================
-- ORA Hockey — cancelled and postponed events
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   games.status              'scheduled' | 'cancelled' | 'postponed'
--   training_sessions.status  'scheduled' | 'cancelled'
--   team_events.status        'scheduled' | 'cancelled'
--   <table>.status_reason     optional "why" shown to the squad (≤ 200 chars)
--
-- Admins cancel (or postpone a game) instead of deleting it, so it stays on
-- the schedule with its RSVPs; reinstating sets it back to 'scheduled'.
-- A cancelled/postponed entry counts for nothing: no appearances, attendance %,
-- fines or POTM (lib/stats.ts, lib/fines-server.ts, components/HomeView.tsx).
--
--  - A cancelled/postponed game has no result (check constraint), so every
--    "played" check (result is not null) already leaves it out
--  - set_match_score() refuses one; ensure_potm_polls() skips it
--  - App RSVPs to one are rejected (existing answers are kept)
--
-- Admin-only: games/trainings/team_events updates are already admin RLS.
-- Re-run safe.
-- =============================================================

alter table public.games add column if not exists status text not null default 'scheduled';
alter table public.games add column if not exists status_reason text;
alter table public.training_sessions add column if not exists status text not null default 'scheduled';
alter table public.training_sessions add column if not exists status_reason text;
alter table public.team_events add column if not exists status text not null default 'scheduled';
alter table public.team_events add column if not exists status_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_status_check') then
    alter table public.games add constraint games_status_check
      check (status in ('scheduled', 'cancelled', 'postponed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_status_no_result') then
    alter table public.games add constraint games_status_no_result
      check (status = 'scheduled' or result is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'training_sessions_status_check') then
    alter table public.training_sessions add constraint training_sessions_status_check
      check (status in ('scheduled', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_events_status_check') then
    alter table public.team_events add constraint team_events_status_check
      check (status in ('scheduled', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_status_reason_length') then
    alter table public.games add constraint games_status_reason_length check (char_length(status_reason) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'training_sessions_status_reason_length') then
    alter table public.training_sessions add constraint training_sessions_status_reason_length check (char_length(status_reason) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_events_status_reason_length') then
    alter table public.team_events add constraint team_events_status_reason_length check (char_length(status_reason) <= 200);
  end if;
end;
$$;

-- ── No score for a cancelled/postponed game ─────────────────
create or replace function public.set_match_score(p_game_id uuid, p_goals_for integer, p_goals_against integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_goals_for is null or p_goals_against is null
     or p_goals_for not between 0 and 99 or p_goals_against not between 0 and 99 then
    raise exception 'Invalid score';
  end if;
  if exists (select 1 from games where id = p_game_id and status <> 'scheduled') then
    raise exception 'This match was cancelled or postponed';
  end if;
  if not exists (select 1 from games where id = p_game_id and game_date <= now()) then
    raise exception 'Match has not been played yet';
  end if;

  update games set
    goals_for = p_goals_for,
    goals_against = p_goals_against,
    result = (case
      when p_goals_for > p_goals_against then 'win'
      when p_goals_for < p_goals_against then 'loss'
      else 'tie'
    end)::game_result
  where id = p_game_id;

  delete from match_goals where game_id = p_game_id and goal_number > p_goals_for;
end;
$$;

-- ── No POTM poll for a cancelled/postponed game ─────────────
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
    and g.status = 'scheduled'
    and g.team_list_status = 'published'
    and exists (select 1 from match_team_lists m where m.game_id = g.id)
    and not exists (select 1 from potm_polls p where p.game_id = g.id)
    and not exists (select 1 from potm pt where pt.game_id = g.id)
  on conflict (game_id) do nothing;
end;
$$;

-- ── No RSVPs to a cancelled/postponed entry (app writes) ────
-- Existing answers stay, so reinstating brings them back. SQL editor /
-- service-role writes pass, like the season lock.
create or replace function public.enforce_session_scheduled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.session_type = 'game' then
    select status into v_status from games where id = new.session_id;
  elsif new.session_type = 'event' then
    select status into v_status from team_events where id = new.session_id;
  else
    select status into v_status from training_sessions where id = new.session_id;
  end if;

  if v_status is not null and v_status <> 'scheduled' then
    raise exception 'This % was %', case new.session_type::text when 'game' then 'match' else new.session_type::text end, v_status;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_session_scheduled on public.attendance;
create trigger attendance_session_scheduled before insert or update on public.attendance
  for each row execute function public.enforce_session_scheduled();
