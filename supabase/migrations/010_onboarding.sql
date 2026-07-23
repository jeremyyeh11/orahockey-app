-- =============================================================
-- ORA Hockey — Self-serve player onboarding (backlog #6)
-- =============================================================
--
-- The roster (players table, admin-controlled) is the real gate;
-- player_whitelist mirrors it and records invite lifecycle:
--   invited_at  — when an admin last generated a setup link
--   claimed_at  — when the player's row got linked to an auth user
--
-- RLS is unchanged: whitelist stays admin-only. The invite server
-- action runs as the signed-in admin for whitelist reads/writes and
-- only uses the service-role client for the auth admin API.
-- =============================================================

alter table player_whitelist
  add column if not exists invited_at timestamptz,
  add column if not exists claimed_at timestamptz;

-- ── Keep whitelist in sync with the roster ───────────────────
-- Adding a player whitelists their email automatically.
create or replace function public.sync_whitelist_on_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into player_whitelist (email) values (new.email)
  on conflict (email) do nothing;
  return new;
end;
$$;

drop trigger if exists players_whitelist_sync on players;
create trigger players_whitelist_sync
after insert on players
for each row execute function public.sync_whitelist_on_player();

-- Mark the invite claimed the moment a player row links to an auth
-- user (link_player_account() on first login, or manual linking).
create or replace function public.mark_whitelist_claimed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_user_id is not null and old.auth_user_id is null then
    update player_whitelist set claimed_at = now() where email = new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists players_whitelist_claimed on players;
create trigger players_whitelist_claimed
after update of auth_user_id on players
for each row execute function public.mark_whitelist_claimed();

-- ── Backfill ─────────────────────────────────────────────────
-- Ensure every roster email has a whitelist row (should already hold).
insert into player_whitelist (email)
select p.email from players p
on conflict (email) do nothing;

-- Players already linked to an auth user count as claimed.
update player_whitelist w
set claimed_at = now()
from players p
where p.email = w.email
  and p.auth_user_id is not null
  and w.claimed_at is null;

-- ── Hygiene (matches 009 hardening) ──────────────────────────
-- Trigger functions are internal-only — not callable over REST.
revoke execute on function public.sync_whitelist_on_player() from public, anon, authenticated;
revoke execute on function public.mark_whitelist_claimed()   from public, anon, authenticated;
