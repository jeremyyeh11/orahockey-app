-- =============================================================
-- ORA Hockey — only the superadmin closes a season
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   is_superadmin()          the caller's players.role is 'superadmin'
--   close_current_season()   (014) now checks is_superadmin() instead of is_admin()
--
-- The admin Home Danger zone is shown to the superadmin only
-- (components/HomeView.tsx) and closeSeason() checks requireSuperadmin().
--
-- Re-run safe.
-- =============================================================

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from players where auth_user_id = auth.uid() and role::text = 'superadmin'
  );
$$;

create or replace function public.close_current_season()
returns text language plpgsql security definer set search_path = public as $$
declare
  cur        seasons%rowtype;
  next_label text;
  next_id    uuid;
begin
  if not public.is_superadmin() then
    raise exception 'Only the superadmin can close a season.';
  end if;

  select * into cur from seasons where is_current for update;
  if not found then
    raise exception 'There is no current season to close.';
  end if;
  if cur.label !~ '^\d{4}$' then
    raise exception 'Season "%" isn''t labelled with a year — close it from the backend.', cur.label;
  end if;
  next_label := (cur.label::int + 1)::text;

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
grant execute on function public.close_current_season() to authenticated;
