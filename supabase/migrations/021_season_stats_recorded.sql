-- =============================================================
-- ORA Hockey — Seasons with only appearances recorded
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Seasons imported from the old caps sheets (2025 and earlier) have who
-- played each game and the scores, but no goals / assists / cards / POTM.
-- seasons.stats_recorded = false makes the app say "stats not recorded" for
-- them instead of showing zeros, and leaves them out of per-appearance rates.
--
-- Re-run safe.
-- =============================================================

alter table public.seasons add column if not exists stats_recorded boolean not null default true;

update public.seasons set stats_recorded = false where label <= '2025' and stats_recorded;
