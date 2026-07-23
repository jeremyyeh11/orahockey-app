-- =============================================================
-- ORA Hockey — Security hardening (go-live quick wins)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Addresses two classes of security-advisor findings:
--
--   1. function_search_path_mutable — is_admin() and
--      link_player_account() were created without a fixed
--      search_path. Pin it to `public` so the resolution path
--      can't be hijacked by a caller-set search_path.
--
--   2. {anon,authenticated}_security_definer_function_executable —
--      SECURITY DEFINER functions are granted to PUBLIC by
--      default, so the unauthenticated `anon` role (whose key
--      ships in the client bundle) can invoke them via
--      /rest/v1/rpc/*. They already reject anon internally via
--      `auth.uid() is null` guards, but we revoke REST access
--      outright as defence-in-depth.
--
-- is_admin() is intentionally left with its default grants: it is
-- evaluated inside RLS USING/WITH CHECK expressions, so the
-- querying role must retain EXECUTE. Only its search_path is fixed.
-- =============================================================

-- ── 1. Pin search_path on the two flagged helpers ────────────
alter function public.is_admin() set search_path = public;
alter function public.link_player_account() set search_path = public;

-- ── 2a. App-facing RPCs: revoke from PUBLIC/anon, keep signed-in
-- These are called by logged-in players/admins from the app.
revoke execute on function public.link_player_account() from public, anon;
grant  execute on function public.link_player_account() to authenticated;

revoke execute on function public.set_match_score(uuid, int, int) from public, anon;
grant  execute on function public.set_match_score(uuid, int, int) to authenticated;

revoke execute on function public.reorder_match_goals(uuid, uuid[], int[]) from public, anon;
grant  execute on function public.reorder_match_goals(uuid, uuid[], int[]) to authenticated;

revoke execute on function public.ensure_potm_polls() from public, anon;
grant  execute on function public.ensure_potm_polls() to authenticated;

revoke execute on function public.cast_potm_vote(uuid, uuid, uuid, uuid) from public, anon;
grant  execute on function public.cast_potm_vote(uuid, uuid, uuid, uuid) to authenticated;

revoke execute on function public.close_potm_poll(uuid) from public, anon;
grant  execute on function public.close_potm_poll(uuid) to authenticated;

-- ── 2b. Internal-only functions: no REST caller at all ───────
-- sync_player_stats_for_game is invoked from set_match_score /
-- the match_goals trigger; trg_match_goals_sync is a trigger
-- function. Neither is ever called over the API — revoke from
-- everyone (SECURITY DEFINER internal calls are unaffected).
revoke execute on function public.sync_player_stats_for_game(uuid) from public, anon, authenticated;
revoke execute on function public.trg_match_goals_sync()          from public, anon, authenticated;
