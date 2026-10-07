-- =============================================================
-- ORA Hockey — Pending players (no email yet)
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Admins can add a player before their onboarding details are in: just a
-- name. The email (their login + what the setup link is tied to) is added
-- later from their profile.
--
--   1. players.email becomes nullable. Unique still holds for real emails
--      (multiple NULLs are allowed); blank strings are rejected so they
--      can't collide or sneak in as a fake email.
--   2. The whitelist sync skips players without an email and also runs when
--      an email is set later.
--   3. New *inactive* players (e.g. past players added retroactively) don't
--      auto-join the current season's squad.
--
-- Re-run safe.
-- =============================================================

alter table public.players alter column email drop not null;

alter table public.players drop constraint if exists players_email_not_blank;
alter table public.players add constraint players_email_not_blank
  check (email is null or btrim(email) <> '');

create or replace function public.sync_whitelist_on_player()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    insert into player_whitelist (email) values (new.email)
    on conflict (email) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists players_whitelist_sync on public.players;
create trigger players_whitelist_sync after insert or update of email on public.players
  for each row execute function public.sync_whitelist_on_player();

create or replace function public.add_player_to_current_season()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Inactive on creation = a past player being added retroactively
  if not new.is_active then
    return new;
  end if;
  insert into season_players (season_id, player_id, jersey_number, position)
  select id, new.id, new.jersey_number, new.position from seasons where is_current
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.add_player_to_current_season() from public, anon, authenticated;
