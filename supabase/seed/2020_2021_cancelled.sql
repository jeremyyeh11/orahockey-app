-- =============================================================
-- ORA Hockey — 2020 and 2021: no season (COVID-19)
-- Creates the two years as locked, empty, cancelled seasons, so a player's
-- season-by-season table reads "Season cancelled (COVID-19)" across the gap
-- instead of "Didn't play this season". Needs migration 026.
--
-- Re-run safe.
-- Run in: Supabase Dashboard → SQL Editor (or via MCP)
-- =============================================================

insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats, cancelled_reason)
select y::text, (y || '-01-01')::date, (y || '-12-31')::date, false, true, '{}', 'COVID-19'
from generate_series(2020, 2021) as y
where not exists (select 1 from seasons s where s.label = y::text);
