-- =============================================================
-- ORA Hockey — Games played with no scoreline kept
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- The 2023 caps sheet has who played each game but no scores. The app counts
-- an appearance only when the game has a result, so those games get
--   games.result = 'unrecorded'
-- (goals_for / goals_against stay null). It counts as played for caps, but
-- not as a win / draw / loss, and the UI says "no scoreline recorded".
--
-- Re-run safe.
-- =============================================================

alter type public.game_result add value if not exists 'unrecorded';
