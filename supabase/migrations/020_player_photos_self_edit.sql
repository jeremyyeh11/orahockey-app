-- =============================================================
-- ORA Hockey — Player photos in Storage + players edit their positions
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Backlog #7 / #11:
--   players.photo_path   the player's photo in the public `player-photos`
--                        Storage bucket (null = silhouette). Uploaded by
--                        admins only — players don't upload their own.
--   self-edit            players may now also change their own positions
--                        (017's whitelist: preferred_name, date_of_birth).
--   position check       positions are FWD / MID / DEF / GK only, now that
--                        players write them directly.
--
-- Re-run safe.
-- =============================================================

alter table public.players add column if not exists photo_path text;

alter table public.players drop constraint if exists players_position_valid;
alter table public.players add constraint players_position_valid
  check (position is null or position <@ array['FWD', 'MID', 'DEF', 'GK']::text[]);

create or replace function public.guard_player_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  self_editable constant text[] := array['preferred_name', 'date_of_birth', 'position'];
begin
  if current_user = 'authenticated'
     and not public.is_admin()
     and (to_jsonb(new) - self_editable) is distinct from (to_jsonb(old) - self_editable)
  then
    raise exception 'Players can only edit their own preferred name, date of birth and positions'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

-- Photos: public to read (the URL is enough), admins write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload player photos" on storage.objects;
create policy "Admins upload player photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'player-photos' and public.is_admin());
drop policy if exists "Admins replace player photos" on storage.objects;
create policy "Admins replace player photos" on storage.objects
  for update to authenticated using (bucket_id = 'player-photos' and public.is_admin());
drop policy if exists "Admins delete player photos" on storage.objects;
create policy "Admins delete player photos" on storage.objects
  for delete to authenticated using (bucket_id = 'player-photos' and public.is_admin());
