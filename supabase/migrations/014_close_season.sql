-- =============================================================
-- ORA Hockey — Close season (admin, from the app)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- close_current_season(): archives the current season and makes the next one
-- current, in one transaction. Admin-only (checked inside — `seasons` itself
-- still has no app write policies, so this function is the only app path).
--
--   1. Current season (label must be a year, e.g. '2027') → is_current false,
--      locked true (archived: read-only to the app, admins included).
--   2. Next season ('2028') → created (nominal 1 Jan – 31 Dec dates), or made
--      current/open if it already exists.
--   3. The new squad starts as the closing season's *active* players, with
--      their jersey numbers.
--
-- Returns the new current season's label. The app asks for three
-- confirmations before calling it (button → "Yes" → type CLOSE).
-- =============================================================

create or replace function public.close_current_season()
returns text language plpgsql security definer set search_path = public as $$
declare
  cur        seasons%rowtype;
  next_label text;
  next_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can close a season.';
  end if;

  select * into cur from seasons where is_current for update;
  if not found then
    raise exception 'There is no current season to close.';
  end if;
  if cur.label !~ '^\d{4}$' then
    raise exception 'Season "%" isn''t labelled with a year — close it from the backend.', cur.label;
  end if;
  next_label := (cur.label::int + 1)::text;

  -- Archive the current season first (only one season may be current)
  update seasons set is_current = false, locked = true where id = cur.id;

  select id into next_id from seasons where label = next_label;
  if next_id is null then
    insert into seasons (label, starts_on, ends_on, is_current, locked)
    values (next_label, make_date(next_label::int, 1, 1), make_date(next_label::int, 12, 31), true, false)
    returning id into next_id;
  else
    update seasons set is_current = true, locked = false where id = next_id;
  end if;

  insert into season_players (season_id, player_id, jersey_number)
  select next_id, sp.player_id, sp.jersey_number
  from season_players sp
  join players p on p.id = sp.player_id
  where sp.season_id = cur.id and p.is_active
  on conflict do nothing;

  return next_label;
end;
$$;

revoke execute on function public.close_current_season() from public, anon;
grant  execute on function public.close_current_season() to authenticated;
