-- =============================================================
-- ORA Hockey — Cap numbers start at #2 (#1 is honorary)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Cap #1 is an honorary cap shared by everyone who played for ORA before the
-- first recorded game (23 Apr 2016). It belongs to no player row, so the first
-- recorded debutant is #2 and every number is one higher than before. A check
-- constraint keeps #1 reserved. Renumbers everyone once (the permanence guard
-- is switched off for this migration only); debut games are kept.
--
-- NOT re-run safe after new debutants have been numbered: it renumbers from
-- scratch. Run once, right after 031.
-- =============================================================

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
  -- #1 is the honorary cap (everyone before 2016), so numbering starts at #2
  set cap_number = (select coalesce(max(cap_number), 1) from players) + t.n,
      debut_game_id = t.game_id
  from todo t
  where p.id = t.id;

  get diagnostics v_count = row_count;
  perform set_config('ora.assigning_caps', 'off', true);
  return v_count;
end;
$$;

-- One-off renumber: clear both, then reassign (same order, same debut games)
alter table public.players disable trigger players_guard_cap_number;
update public.players set cap_number = null, debut_game_id = null where cap_number is not null;
alter table public.players enable trigger players_guard_cap_number;

select public.assign_cap_numbers();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_cap_number_from_2') then
    alter table public.players add constraint players_cap_number_from_2 check (cap_number >= 2);
  end if;
end $$;
