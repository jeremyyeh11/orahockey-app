-- =============================================================
-- ORA Hockey — finemaster and superadmin roles
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- players.role gains two values:
--   finemaster  a player who also waives fines and marks them paid
--   superadmin  an admin who can also waive and settle fines
--
-- can_manage_fines() is true for finemasters and the superadmin; 035 hands it
-- the fine_waivers (018) / fine_payments (019) policies. is_admin() counts the
-- superadmin, so it keeps every admin power.
--
-- Only a superadmin can make someone a superadmin, or change a superadmin's
-- role (the SQL editor / service role still can). Admins can still appoint
-- finemasters.
--
-- The new enum values can't be used in the transaction that adds them, so the
-- functions below compare role::text.
--
-- Additive only: the deployed app keeps working before and after.
--
-- Re-run safe.
-- =============================================================

alter type public.player_role add value if not exists 'finemaster';
alter type public.player_role add value if not exists 'superadmin';

create or replace function public.is_admin()
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
      and role::text in ('admin', 'superadmin')
  );
$$;

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
      and role::text in ('finemaster', 'superadmin')
  );
$$;

-- Like is_admin(): evaluated inside RLS policies, so signed-in users keep EXECUTE
revoke execute on function public.can_manage_fines() from public, anon;
grant  execute on function public.can_manage_fines() to authenticated;

-- Superadmin is granted and removed by a superadmin only
create or replace function public.guard_superadmin_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and (new.role::text = 'superadmin' or (tg_op = 'UPDATE' and old.role::text = 'superadmin'))
     and new.role is distinct from (case when tg_op = 'UPDATE' then old.role end)
     and not exists (select 1 from players where auth_user_id = auth.uid() and role::text = 'superadmin')
  then
    raise exception 'Only a superadmin can give or remove the superadmin role'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_superadmin on public.players;
create trigger players_guard_superadmin
  before insert or update of role on public.players
  for each row execute function public.guard_superadmin_role();
