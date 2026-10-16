-- =============================================================
-- ORA Hockey — committee titles
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 035
-- =============================================================
--
-- players.titles labels a player's committee job (Coaching, Fitness, ...).
-- It's a label only: permissions stay on players.role. Most titled players
-- are admins; Equipment is a plain player with the tag. One player can hold
-- several titles. Admins set them; the self-edit guard (020) already blocks
-- players from changing their own, since titles isn't self-editable.
--
-- Also sets the 2026 committee. Re-run safe.
-- =============================================================

alter table public.players add column if not exists titles text[] not null default '{}';

alter table public.players drop constraint if exists players_titles_valid;
alter table public.players add constraint players_titles_valid
  check (titles <@ array['coaching', 'fitness', 'welfare', 'equipment', 'training']::text[]);

-- 2026 committee (matched on full_name; superadmin and finemaster unchanged)
update public.players p
set role = c.role::public.player_role, titles = c.titles
from (values
  ('ISHWARPAL SINGH GREWAL',              'admin',  array['coaching']),
  ('JASPAL SINGH GREWAL',                 'admin',  array['coaching']),
  ('AHMAD FARIS BIN MUHD JOHARI',         'admin',  array['coaching']),
  ('AKASH PREBHASH CHANDRA',              'admin',  array['coaching', 'training']),
  ('HIREN KOBAN',                         'admin',  array['coaching']),
  ('LEE KANG ZHENG',                      'admin',  array['fitness']),
  ('ASHWIN UNNITHAN',                     'admin',  array['welfare']),
  ('TAY BOON KAI',                        'player', array['equipment']),
  ('MATTEUS OOI YIYANG',                  'admin',  array['training']),
  ('MUHAMAD RAZIQ BIN MOHD NOOR',         'admin',  array[]::text[]),
  ('ALTON CHUA KAI CONG',                 'admin',  array[]::text[]),
  ('KENT LOO TIAN POH',                   'admin',  array[]::text[])
) as c(full_name, role, titles)
where p.full_name = c.full_name;
