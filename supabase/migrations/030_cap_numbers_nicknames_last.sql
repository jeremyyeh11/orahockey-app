-- =============================================================
-- ORA Hockey — Cap numbers: nickname-only names go last
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Within a debut game, players whose full name is still just the caps-sheet
-- nickname (one word, e.g. HARI.R, EUGENE) are numbered after everyone with a
-- real full name; each group stays in full-name order. Renumbers everyone once
-- (the permanence guard is switched off for this migration only).
--
-- NOT re-run safe after new debutants have been numbered: it renumbers from
-- scratch. Run once, right after 029.
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
           row_number() over (order by d.debut_at,
                             (trim(p.full_name) !~ '\s'),  -- nickname-only names last
                             upper(trim(p.full_name)),
                             p.id) as n
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

-- One-off renumber with the new order
alter table public.players disable trigger players_guard_cap_number;
update public.players set cap_number = null where cap_number is not null;
alter table public.players enable trigger players_guard_cap_number;

select public.assign_cap_numbers();
