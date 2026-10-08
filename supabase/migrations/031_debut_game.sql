-- =============================================================
-- ORA Hockey — Debut game stored alongside the cap number
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   players.debut_game_id  the game the player debuted in (their earliest past
--                          game with an 'attending' RSVP). Set at the same
--                          moment as cap_number, by assign_cap_numbers(), and
--                          permanent like it: both are null (hasn't played) or
--                          both are set, and neither can change once set.
--
-- A debut game can't be deleted (on delete restrict).
--
-- Re-run safe.
-- =============================================================

alter table public.players
  add column if not exists debut_game_id uuid references public.games(id) on delete restrict;

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
    select distinct on (a.player_id) a.player_id, g.id as game_id, g.game_date as debut_at
    from attendance a
    join games g on g.id = a.session_id
    where a.session_type = 'game'
      and a.status = 'attending'
      and g.game_date < now()
    order by a.player_id, g.game_date, g.id
  ),
  todo as (
    select p.id,
           d.game_id,
           row_number() over (order by d.debut_at,
                             (trim(p.full_name) !~ '\s'),  -- nickname-only names last
                             upper(trim(p.full_name)),
                             p.id) as n
    from players p
    join debut d on d.player_id = p.id
    where p.cap_number is null
  )
  update players p
  set cap_number = (select coalesce(max(cap_number), 0) from players) + t.n,
      debut_game_id = t.game_id
  from todo t
  where p.id = t.id;

  get diagnostics v_count = row_count;
  perform set_config('ora.assigning_caps', 'off', true);
  return v_count;
end;
$$;

-- Cap number and debut game are immutable; only assign_cap_numbers() sets them.
create or replace function public.guard_cap_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.cap_number is not null or new.debut_game_id is not null then
      raise exception 'cap_number / debut_game_id are assigned automatically';
    end if;
  elsif new.cap_number is distinct from old.cap_number
     or new.debut_game_id is distinct from old.debut_game_id then
    if old.cap_number is not null and new.cap_number is distinct from old.cap_number then
      raise exception 'cap_number is permanent (player already cap #%)', old.cap_number;
    end if;
    if old.debut_game_id is not null then
      raise exception 'debut_game_id is permanent';
    end if;
    if coalesce(current_setting('ora.assigning_caps', true), 'off') <> 'on' then
      raise exception 'cap_number / debut_game_id are assigned automatically';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_cap_number on public.players;
create trigger players_guard_cap_number
  before insert or update of cap_number, debut_game_id on public.players
  for each row execute function public.guard_cap_number();

-- Backfill the debut game for everyone already numbered
do $$
begin
  perform set_config('ora.assigning_caps', 'on', true);

  update players p
  set debut_game_id = d.game_id
  from (
    select distinct on (a.player_id) a.player_id, g.id as game_id
    from attendance a
    join games g on g.id = a.session_id
    where a.session_type = 'game'
      and a.status = 'attending'
      and g.game_date < now()
    order by a.player_id, g.game_date, g.id
  ) d
  where d.player_id = p.id
    and p.cap_number is not null
    and p.debut_game_id is null;

  perform set_config('ora.assigning_caps', 'off', true);
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_cap_number_debut_game_together') then
    alter table public.players add constraint players_cap_number_debut_game_together
      check ((cap_number is null) = (debut_game_id is null));
  end if;
end $$;
