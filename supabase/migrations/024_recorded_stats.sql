-- =============================================================
-- ORA Hockey — Which stats a season recorded; goals of unknown type
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Old seasons kept different amounts: 2025 only appearances, 2024 also goal
-- scorers (no goal types) and Man of the Match. Replaces 021's single
-- stats_recorded flag with a list:
--   seasons.recorded_stats  any of goals, goal_types, assists, cards, potm
--                           (all five by default; '{}' = appearances only)
--   match_goals.assist_kind 'unrecorded' — a goal whose type (field goal /
--                           PC / PS) and assist weren't recorded
--   player_stats.goals_untyped  those goals per player, per game (synced
--                           from match_goals like the typed ones)
--
-- Re-run safe.
-- =============================================================

alter table public.seasons
  add column if not exists recorded_stats text[] not null default array['goals', 'goal_types', 'assists', 'cards', 'potm'];
alter table public.seasons drop constraint if exists seasons_recorded_stats_valid;
alter table public.seasons add constraint seasons_recorded_stats_valid
  check (recorded_stats <@ array['goals', 'goal_types', 'assists', 'cards', 'potm']);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'seasons' and column_name = 'stats_recorded') then
    update public.seasons set recorded_stats = '{}' where not stats_recorded;
    alter table public.seasons drop column stats_recorded;
  end if;
end;
$$;
update public.seasons set recorded_stats = array['goals', 'potm'] where label = '2024';

alter table public.match_goals drop constraint if exists match_goals_assist_kind_check;
alter table public.match_goals add constraint match_goals_assist_kind_check
  check (assist_kind in ('player', 'pc', 'ps', 'unrecorded'));

alter table public.player_stats add column if not exists goals_untyped smallint not null default 0;

create or replace function public.sync_player_stats_for_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into player_stats (player_id, game_id, goals_fg, goals_pc, goals_ps, goals_untyped, assists)
  select ids.player_id, p_game_id,
         coalesce(s.fg, 0), coalesce(s.pc, 0), coalesce(s.ps, 0), coalesce(s.untyped, 0), coalesce(a.n, 0)
  from (
    select scorer_id as player_id from match_goals where game_id = p_game_id
    union
    select assist_player_id from match_goals where game_id = p_game_id and assist_player_id is not null
    union
    select player_id from player_stats where game_id = p_game_id
  ) ids
  left join (
    select scorer_id,
           count(*) filter (where assist_kind is null or assist_kind = 'player') as fg,
           count(*) filter (where assist_kind = 'pc') as pc,
           count(*) filter (where assist_kind = 'ps') as ps,
           count(*) filter (where assist_kind = 'unrecorded') as untyped
    from match_goals where game_id = p_game_id
    group by scorer_id
  ) s on s.scorer_id = ids.player_id
  left join (
    select assist_player_id, count(*) as n
    from match_goals where game_id = p_game_id and assist_player_id is not null
    group by assist_player_id
  ) a on a.assist_player_id = ids.player_id
  on conflict (player_id, game_id) do update set
    goals_fg      = excluded.goals_fg,
    goals_pc      = excluded.goals_pc,
    goals_ps      = excluded.goals_ps,
    goals_untyped = excluded.goals_untyped,
    assists       = excluded.assists;
end;
$$;
