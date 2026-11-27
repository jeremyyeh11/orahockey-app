-- =============================================================
-- ORA Hockey — Players upload their own photo
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Reverses 020's "admins only" photo rule: every player may now set their own
-- photo from the Profile tab. Admins still manage anyone's.
--
--   photo folder     a photo always lives in its player's folder
--                    (`{player id}/…`), so a player can only point their row
--                    at a file they could upload themselves.
--   self-edit        photo_path joins the self-update guard's whitelist.
--   storage          players upload to / delete from their own folder only;
--                    nobody but admins replaces (update) an object.
--   select           storage's remove() needs to SELECT the rows it deletes.
--                    020 had no select policy, so replacing a photo silently
--                    left the old file behind. Admins see every object,
--                    players their own folder. Reading the images themselves
--                    goes through the public URL and needs no policy.
--
-- Re-run safe.
-- =============================================================

alter table public.players drop constraint if exists players_photo_in_own_folder;
alter table public.players add constraint players_photo_in_own_folder
  check (photo_path is null or split_part(photo_path, '/', 1) = id::text);

create or replace function public.guard_player_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  self_editable constant text[] := array['preferred_name', 'date_of_birth', 'position', 'photo_path'];
begin
  if current_user = 'authenticated'
     and not public.is_admin()
     and (to_jsonb(new) - self_editable) is distinct from (to_jsonb(old) - self_editable)
  then
    raise exception 'Players can only edit their own preferred name, date of birth, positions and photo'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

-- The signed-in user's player id as text, matched against an object's folder
create or replace function public.my_player_folder()
returns text
language sql
stable
set search_path = public
as $$
  select id::text from public.players where auth_user_id = auth.uid();
$$;

drop policy if exists "Players upload own photo" on storage.objects;
create policy "Players upload own photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = public.my_player_folder());

drop policy if exists "Players delete own photos" on storage.objects;
create policy "Players delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = public.my_player_folder());

drop policy if exists "See player photo objects" on storage.objects;
create policy "See player photo objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'player-photos' and (public.is_admin() or (storage.foldername(name))[1] = public.my_player_folder()));
