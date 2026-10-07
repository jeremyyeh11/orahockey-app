-- 017_players_self_update_guard.sql
-- The "Players can update their own record" policy (001) lets a player update
-- EVERY column of their own players row through the API — including role
-- (self-promote to admin), email, auth_user_id, team_id and jersey_number.
-- RLS can't restrict columns, so a BEFORE UPDATE trigger does: a non-admin
-- caller coming straight from the API (current_user = 'authenticated') may
-- only change the self-service columns below; any other change is rejected.
--
-- Unaffected: admins (is_admin()), the service role (server-side invite
-- actions), and security-definer functions, which run as their owner
-- (postgres) — e.g. link_player_account() setting auth_user_id on first login.
--
-- Whitelist, not blacklist: columns added later are protected by default.
-- Backlog #11 (player self-edit) extends self_editable (e.g. a photo column).

create or replace function public.guard_player_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  self_editable constant text[] := array['preferred_name', 'date_of_birth'];
begin
  if current_user = 'authenticated'
     and not public.is_admin()
     and (to_jsonb(new) - self_editable) is distinct from (to_jsonb(old) - self_editable)
  then
    raise exception 'Players can only edit their own preferred name and date of birth'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_self_update on public.players;
create trigger players_guard_self_update
  before update on public.players
  for each row execute function public.guard_player_self_update();
