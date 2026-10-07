-- =============================================================
-- ORA Hockey — End times + report-early minutes on schedule entries
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Games, trainings and team events get two optional fields:
--   ends_at         when it finishes (must be after the start)
--   report_minutes  how many minutes early to report (0–600)
--
-- The five RI trainings added in Oct 2026 carried this in their notes
-- ("Report 8:45 am · Training 9–11am"); they move into the new fields.
--
-- Re-run safe.
-- =============================================================

alter table public.games             add column if not exists ends_at timestamptz, add column if not exists report_minutes smallint;
alter table public.training_sessions add column if not exists ends_at timestamptz, add column if not exists report_minutes smallint;
alter table public.team_events       add column if not exists ends_at timestamptz, add column if not exists report_minutes smallint;

alter table public.games drop constraint if exists games_ends_after_start;
alter table public.games add constraint games_ends_after_start check (ends_at is null or ends_at > game_date);
alter table public.games drop constraint if exists games_report_minutes_range;
alter table public.games add constraint games_report_minutes_range check (report_minutes is null or report_minutes between 0 and 600);

alter table public.training_sessions drop constraint if exists training_sessions_ends_after_start;
alter table public.training_sessions add constraint training_sessions_ends_after_start check (ends_at is null or ends_at > session_date);
alter table public.training_sessions drop constraint if exists training_sessions_report_minutes_range;
alter table public.training_sessions add constraint training_sessions_report_minutes_range check (report_minutes is null or report_minutes between 0 and 600);

alter table public.team_events drop constraint if exists team_events_ends_after_start;
alter table public.team_events add constraint team_events_ends_after_start check (ends_at is null or ends_at > event_date);
alter table public.team_events drop constraint if exists team_events_report_minutes_range;
alter table public.team_events add constraint team_events_report_minutes_range check (report_minutes is null or report_minutes between 0 and 600);

update public.training_sessions
  set ends_at = session_date + interval '2 hours', report_minutes = 15, notes = null
  where notes = 'Report 8:45 am · Training 9–11am';
