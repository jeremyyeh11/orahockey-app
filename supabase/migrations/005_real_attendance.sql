-- Migration 005: Fix roster + replace attendance with real data
-- 1. Deactivate Alif Ayden and Garren (don't delete — preserve referential integrity)
-- 2. Update Gabriel's jersey number to 55
-- 3. Replace game attendance with real per-game data (14 games, 2026 season)

do $$
declare
  v_team uuid;
  g_rec record;
  g_idx int := 0;
  v_player uuid;
  v_attended int;
  v_status attendance_status;
begin
  select id into v_team from teams limit 1;
  if v_team is null then
    raise exception 'No team found';
  end if;

  -- 1. Deactivate Alif Ayden and Garren
  update players set is_active = false
  where full_name in ('Alif Ayden', 'Garren');

  -- 2. Fix Gabriel's jersey number
  update players set jersey_number = 55
  where full_name = 'Gabriel';

  -- 3. Clear existing game attendance for this team's games
  delete from attendance
  where session_type = 'game'
  and session_id in (select id from games where team_id = v_team);

  -- 4. Insert real attendance data
  --    Format: 'Name', jersey, caps, '14-char attendance string'
  --    1 = attending, 0 = not attending
  --    Games are in chronological order (oldest first)

  -- Game IDs in chronological order
  create temp table game_order (idx int, game_id uuid) on commit drop;
  insert into game_order
  select row_number() over (order by game_date) - 1, id
  from games where team_id = v_team order by game_date;

  -- Helper: attendance string per player
  create temp table att_data (
    player_name text,
    jersey int,
    caps int,
    att_string text
  ) on commit drop;

  insert into att_data values
    ('Akash',       36,  2,  '00000000000011'),
    ('Alton',        5,  7,  '11111000000011'),
    ('Aniq',        61,  3,  '00000010001100'),
    ('Ashwin',      14,  9,  '00111101100111'),
    ('Boon Kai',     0, 10,  '11101111111000'),
    ('Faris',       11, 14,  '11111111111111'),
    ('Gabriel',     55,  3,  '00000001011000'),
    ('Hafiz',        2,  1,  '00000001000000'),
    ('Hiren',        7, 14,  '11111111111111'),
    ('Ian',         31,  8,  '00000111111011'),
    ('Ish',         13, 13,  '10111111111111'),
    ('Jasmeet',     26, 10,  '11111111101000'),
    ('Jaspal',      10, 14,  '11111111111111'),
    ('Jaydon',      18,  4,  '01110000100000'),
    ('Jeremy',      22, 14,  '11111111111111'),
    ('Joash',       79,  8,  '01011000111101'),
    ('Jorim',       68,  9,  '01011000111111'),
    ('Joshua',      95,  7,  '11110010001010'),
    ('Kang',        29, 12,  '11110011111111'),
    ('Keaen',       15,  3,  '00000000111000'),
    ('Kevin Saji',  87, 12,  '11111111110011'),
    ('Matteus',     30,  8,  '11110000001111'),
    ('Peh Yu',      85, 13,  '11111111111011'),
    ('Raziq',       24, 13,  '11111111110111'),
    ('Rifqi',        9, 14,  '11111111111111'),
    ('Ryan Naidu',  17,  7,  '10011111000010'),
    ('Ryan Vir',    16, 12,  '11111101111110');

  -- Insert attendance rows
  for g_idx in 0..13 loop
    select game_id into g_rec from game_order where idx = g_idx;
    if g_rec is null then continue; end if;

    for v_player in
      select p.id from players p
      join att_data d on p.full_name = d.player_name
      where p.is_active
      and substring(d.att_string from g_idx + 1 for 1) = '1'
    loop
      insert into attendance (player_id, session_id, session_type, status, responded_at)
      values (v_player, g_rec, 'game', 'attending', g_rec.game_date - interval '2 days')
      on conflict (player_id, session_id, session_type) do nothing;
    end loop;
  end loop;

  raise notice 'Attendance migration complete';
end $$;
