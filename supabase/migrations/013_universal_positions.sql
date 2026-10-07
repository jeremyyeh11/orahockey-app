-- =============================================================
-- ORA Hockey — Positions are per player, not per season
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- 011 stored a position per season (season_players.position). Positions are
-- universal/cumulative instead: one set on players.position covering every
-- position the player plays. Jersey numbers stay per season.
--
--   1. Merge any season positions into players.position (union — nothing lost).
--   2. The current-season auto-join trigger stops copying position.
--   3. Drop season_players.position.
--
-- Re-run safe.
-- =============================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'season_players' and column_name = 'position') then
    update public.players p set position = merged.pos
    from (
      select player_id, array_agg(distinct pos) pos
      from (
        select id as player_id, unnest(position) as pos from public.players
        union
        select player_id, unnest(position) from public.season_players
      ) u
      group by player_id
    ) merged
    where merged.player_id = p.id
      and not (coalesce(p.position, '{}') @> merged.pos and merged.pos @> coalesce(p.position, '{}'));
  end if;
end;
$$;

create or replace function public.add_player_to_current_season()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Inactive on creation = a past player being added retroactively
  if not new.is_active then
    return new;
  end if;
  insert into season_players (season_id, player_id, jersey_number)
  select id, new.id, new.jersey_number from seasons where is_current
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.add_player_to_current_season() from public, anon, authenticated;

alter table public.season_players drop column if exists position;
