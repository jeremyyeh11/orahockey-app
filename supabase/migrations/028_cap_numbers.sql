-- =============================================================
-- ORA Hockey — Cap numbers (permanent debut order)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   players.cap_number  ORA cap #N: the Nth player to debut for the club,
--                       counted from the first recorded game (23 Apr 2016).
--                       null = hasn't played a game yet.
--
-- Debut = the player's earliest past game with an 'attending' RSVP. Players
-- who debuted in the same game are numbered alphabetically by their display
-- name (preferred name, else first word of the full name — same as
-- preferredName() in components/RosterList.tsx).
--
-- Numbers are permanent: once set, a cap number can never change or be
-- cleared, and only assign_cap_numbers() can set one. New debutants get the
-- next number after the highest ever handed out (a deleted player's number is
-- never reused). assign_cap_numbers() runs after any change to games or
-- attendance, so a debutant is numbered as soon as their game is in the past
-- and something is recorded (score, RSVP edit, ...).
--
-- Re-run safe.
-- =============================================================

alter table public.players add column if not exists cap_number smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_cap_number_key') then
    alter table public.players add constraint players_cap_number_key unique (cap_number);
  end if;
end $$;

-- Hands out cap numbers to every player who has debuted but has none yet.
create or replace function public.assign_cap_numbers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('assign_cap_numbers'));
  perform set_config('ora.assigning_caps', 'on', true);

  with debut as (
    select a.player_id, min(g.game_date) as debut_at
    from attendance a
    join games g on g.id = a.session_id
    where a.session_type = 'game'
      and a.status = 'attending'
      and g.game_date < now()
    group by a.player_id
  ),
  todo as (
    select p.id,
           row_number() over (
             order by d.debut_at,
                      upper(coalesce(nullif(trim(p.preferred_name), ''), split_part(trim(p.full_name), ' ', 1))),
                      p.full_name,
                      p.id
           ) as n
    from players p
    join debut d on d.player_id = p.id
    where p.cap_number is null
  )
  update players p
  set cap_number = (select coalesce(max(cap_number), 0) from players) + t.n
  from todo t
  where p.id = t.id;

  get diagnostics v_count = row_count;
  perform set_config('ora.assigning_caps', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.assign_cap_numbers() from public, anon, authenticated;

-- Cap numbers are immutable and only assign_cap_numbers() may set them.
create or replace function public.guard_cap_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.cap_number is not null then
      raise exception 'cap_number is assigned automatically';
    end if;
  elsif new.cap_number is distinct from old.cap_number then
    if old.cap_number is not null then
      raise exception 'cap_number is permanent (player already cap #%)', old.cap_number;
    end if;
    if coalesce(current_setting('ora.assigning_caps', true), 'off') <> 'on' then
      raise exception 'cap_number is assigned automatically';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_cap_number on public.players;
create trigger players_guard_cap_number
  before insert or update of cap_number on public.players
  for each row execute function public.guard_cap_number();

-- Number new debutants whenever games or RSVPs change.
create or replace function public.assign_cap_numbers_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_cap_numbers();
  return null;
end;
$$;

drop trigger if exists games_assign_cap_numbers on public.games;
create trigger games_assign_cap_numbers
  after insert or update on public.games
  for each statement execute function public.assign_cap_numbers_trigger();

drop trigger if exists attendance_assign_cap_numbers on public.attendance;
create trigger attendance_assign_cap_numbers
  after insert or update on public.attendance
  for each statement execute function public.assign_cap_numbers_trigger();

-- Backfill: Ashraf was imported as 'ACAP' (the caps-sheet nickname); the club
-- calls him Ashraf. Rename before numbering so the alphabetical tie-break uses it.
update public.players
set preferred_name = 'ASHRAF'
where preferred_name = 'ACAP';

select public.assign_cap_numbers();
