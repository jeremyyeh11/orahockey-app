-- =============================================================
-- ORA Hockey — Cancelled seasons (2020 and 2021 were COVID years)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   seasons.cancelled_reason  null = a normal season; text (e.g. 'COVID-19')
--                             = the season never ran. The player profile
--                             shows "Season cancelled (COVID-19)" instead of
--                             "Didn't play this season", and the season
--                             switcher leaves it out (there's nothing to see).
--
-- Re-run safe.
-- =============================================================

alter table public.seasons add column if not exists cancelled_reason text;
