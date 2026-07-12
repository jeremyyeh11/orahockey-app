-- =============================================================
-- Goal types: field goal / penalty corner / penalty stroke
-- Applied to live DB on 2026-07-12 (migration: goal_types_fg_pc_ps)
-- `goals` becomes a generated total so existing reads keep working.
-- =============================================================

alter table player_stats add column goals_fg smallint not null default 0;
alter table player_stats add column goals_pc smallint not null default 0;
alter table player_stats add column goals_ps smallint not null default 0;

-- existing goals treated as field goals
update player_stats set goals_fg = goals;

alter table player_stats drop column goals;
alter table player_stats add column goals smallint generated always as (goals_fg + goals_pc + goals_ps) stored;
