-- =============================================================
-- ORA Hockey — Player account auto-link function
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- =============================================================

-- Called from middleware on first login.
-- Finds a players row matching the authenticated user's email
-- (with no auth_user_id set yet) and links it.
-- security definer so it bypasses RLS.
create or replace function link_player_account()
returns void
language sql
security definer
as $$
  update players
  set auth_user_id = auth.uid()
  where email = (select email from auth.users where id = auth.uid())
    and auth_user_id is null;
$$;
