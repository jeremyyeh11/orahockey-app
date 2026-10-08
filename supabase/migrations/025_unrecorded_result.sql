-- =============================================================
-- ORA Hockey — Games played with no scoreline kept
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Caps sheets list who played each game but not always the score. The app
-- counts an appearance only when the game has a result, so a game with no
-- scoreline gets
--   games.result = 'unrecorded'
-- (goals_for / goals_against stay null). It counts as played for caps, but
-- not as a win / draw / loss, and the UI says "no scoreline recorded".
-- (2023 was first imported this way; its scores were added afterwards from
-- the league results page, so no game uses it today.)
--
-- Re-run safe.
-- =============================================================

alter type public.game_result add value if not exists 'unrecorded';
