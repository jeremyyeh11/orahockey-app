-- =============================================================
-- ORA Hockey — finemaster becomes a title; only the superadmin assigns
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 036
-- =============================================================
--
-- Roles are now player / admin / superadmin. Finemaster moves to
-- players.titles (036) and is the one title that grants something:
-- can_manage_fines() is the superadmin or anyone titled finemaster.
-- ('finemaster' stays in the player_role enum — Postgres can't drop an enum
-- value — but a check constraint keeps it unused.)
--
-- Only a superadmin can change anyone's role or titles from the app
-- (guard_player_roles replaces guard_superadmin_role from 034). Other admins
-- can still add players, as plain untitled players. SQL editor / service-role
-- writes pass.
--
-- Re-run safe.
-- =============================================================

alter table public.players drop constraint if exists players_titles_valid;
alter table public.players add constraint players_titles_valid
  check (titles <@ array['coaching', 'fitness', 'welfare', 'equipment', 'training', 'finemaster']::text[]);

update public.players
set role = 'player',
    titles = case when 'finemaster' = any(titles) then titles else array_append(titles, 'finemaster') end
where role::text = 'finemaster';

alter table public.players drop constraint if exists players_role_valid;
alter table public.players add constraint players_role_valid
  check (role::text in ('player', 'admin', 'superadmin'));

create or replace function public.can_manage_fines()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from players
    where auth_user_id = auth.uid()
      and (role::text = 'superadmin' or 'finemaster' = any(titles))
  );
$$;

-- Roles and titles are given and removed by the superadmin only
create or replace function public.guard_player_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and (
       (tg_op = 'INSERT' and (new.role::text <> 'player' or new.titles <> '{}'))
       or (tg_op = 'UPDATE' and (new.role is distinct from old.role or new.titles is distinct from old.titles))
     )
     and not exists (select 1 from players where auth_user_id = auth.uid() and role::text = 'superadmin')
  then
    raise exception 'Only the superadmin can assign roles and titles'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_superadmin on public.players;
drop function if exists public.guard_superadmin_role();
drop trigger if exists players_guard_roles on public.players;
create trigger players_guard_roles
  before insert or update of role, titles on public.players
  for each row execute function public.guard_player_roles();
