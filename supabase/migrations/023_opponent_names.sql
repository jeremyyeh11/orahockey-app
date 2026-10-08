-- =============================================================
-- ORA Hockey — Full names for the rest of the league's clubs
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
-- Short names (games.opponent) stay as they are for titles; these show in
-- the game details. Re-run safe.

insert into public.opponents (short_name, full_name) values
  ('Hollandse',  'Hollandse Club'),
  ('Jansenites', 'Jansenites Hockey Club'),
  ('Khalsa',     'Singapore Khalsa Association'),
  ('OVA-VJC',    'Old Victorians'' Association – Victoria Junior College'),
  ('Team HI',    'Team Hockey Innovative'),
  ('Tornados',   'Tornados Hockey Club')
on conflict (short_name) do update set full_name = excluded.full_name;
