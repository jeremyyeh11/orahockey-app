-- =============================================================
-- ORA Hockey — 2017 season (National Hockey League 1) from the caps sheet
-- Source: "ORA caps - 2017 (DONE).csv" — who played each of the 14 league
-- games. No scores were recorded (result 'unrecorded': counts as played for
-- caps, no score or W-D-L — migration 025), and no home/away, goals /
-- assists / cards / POTM / training attendance, or kick-off times (15:00 is
-- a placeholder). Update the game rows here if results turn up.
--
-- Creates: a locked 2017 season (recorded_stats = appearances only), one
-- opponent (CSC — Ceylon Sports Club), 4 past players not yet in the app
-- (Dylan Wang, Akmal, Haseef, Ramzi — inactive), the 14 games, the 2017
-- squad and 212 caps (RSVP 'attending' on each game). Sheet names mapped to
-- players by hand (Tim = Timothy, Bapit = Hafiz, CY = Chee Yong, Jeremy =
-- Jeremy Yeh, Ethan = Ethan Tan, Howzhi = Yong How Zhi, Dylan = Dylan Wang,
-- Naidu = Ryan Jay Naidu, Ian = Ian Vanderput, Jans = Jansenites).
--
-- Re-run safe: does nothing if a 2017 season already exists.
-- Run in: Supabase Dashboard → SQL Editor (or via MCP)
-- =============================================================

do $$
declare
  v_team   uuid := (select id from teams limit 1);
  v_season uuid;
  v_game   uuid;
  g        record;
  missing  text;
begin
  if exists (select 1 from seasons where label = '2017') then
    raise notice '2017 season already exists — skipping';
    return;
  end if;

  insert into opponents (short_name, full_name)
  values ('CSC', 'Ceylon Sports Club')
  on conflict (short_name) do nothing;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2017', '2017-01-01', '2017-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('DYLAN WANG', null), ('AKMAL', null), ('HASEEF', null), ('RAMZI', null)) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2017-04-22 15:00+08', 'SCC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'CHEE YONG', 'ZAKI', 'NICK', 'AHMAD FARIS BIN MUHD JOHARI', 'DYLAN WANG', 'FAZLY', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AKMAL', 'JASMEET SINGH', 'HANIF', 'IAN VANDERPUT', 'AKASH PREBHASH CHANDRA', 'MARK CHEONG CHEE HAN', 'KEANE', 'MARCUS']),
    ('2017-04-23 15:00+08', 'SRC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'HASEEF', 'ALTON CHUA KAI CONG', 'ETHAN TAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'RAMZI', 'FAZLY', 'JASMEET SINGH', 'HANIF', 'JEREMY YEH BO HSIEN', 'AKASH PREBHASH CHANDRA', 'MARK CHEONG CHEE HAN', 'KEANE', 'IAN VANDERPUT', 'BRENNEN', 'CALEB ANG']),
    ('2017-05-06 15:00+08', 'CSC', null::smallint, null::smallint, 'unrecorded', array['JASPAL SINGH GREWAL', 'AHMAD FARIS BIN MUHD JOHARI', 'FAZLY', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MARK CHEONG CHEE HAN', 'JASMEET SINGH', 'IAN VANDERPUT', 'HASEEF', 'ADAM', 'NICK', 'ZAKI', 'ETHAN TAN', 'EASHWAR']),
    ('2017-05-07 15:00+08', 'Hollandse', null::smallint, null::smallint, 'unrecorded', array['ZAKI', 'JASPAL SINGH GREWAL', 'IAN VANDERPUT', 'AHMAD FARIS BIN MUHD JOHARI', 'FAZLY', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MARK CHEONG CHEE HAN', 'DYLAN WANG', 'ALTON CHUA KAI CONG', 'KEANE', 'RAMZI', 'AKMAL']),
    ('2017-05-12 15:00+08', 'Khalsa', null::smallint, null::smallint, 'unrecorded', array['FAZLY', 'MARK CHEONG CHEE HAN', 'NICK', 'AHMAD FARIS BIN MUHD JOHARI', 'JASMEET SINGH', 'DYLAN WANG', 'ZAKI', 'ISHWARPAL SINGH GREWAL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AKASH PREBHASH CHANDRA', 'JASPAL SINGH GREWAL', 'CALEB ANG', 'RAMZI', 'BRENNEN', 'HASEEF', 'MARCUS']),
    ('2017-05-14 15:00+08', 'SCC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'IAN VANDERPUT', 'JASMEET SINGH', 'MARK CHEONG CHEE HAN', 'ZAKI', 'AMOS', 'JEREMY YEH BO HSIEN', 'KEANE', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'HAO DUAN', 'BRENNEN', 'AKASH PREBHASH CHANDRA', 'FAZLY', 'DYLAN WANG', 'RAMZI', 'ISHWARPAL SINGH GREWAL']),
    ('2017-05-21 15:00+08', 'Tornados', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'IAN VANDERPUT', 'RAMZI', 'MARCUS', 'HASEEF', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AHMAD FARIS BIN MUHD JOHARI', 'AKASH PREBHASH CHANDRA', 'JASMEET SINGH', 'BRENNEN', 'HANIF', 'MARK CHEONG CHEE HAN', 'JASPAL SINGH GREWAL', 'CALEB ANG', 'ISHWARPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'HAO DUAN', 'KEANE']),
    ('2017-05-26 15:00+08', 'Jansenites', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'IAN VANDERPUT', 'ISHWARPAL SINGH GREWAL', 'CALEB ANG', 'NICK', 'AHMAD FARIS BIN MUHD JOHARI', 'ZAKI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'RAMZI', 'AKASH PREBHASH CHANDRA', 'HANIF', 'JEREMY YEH BO HSIEN', 'JASPAL SINGH GREWAL', 'FAZLY', 'CHEE YONG', 'AMOS', 'MARK CHEONG CHEE HAN', 'YONG HOW ZHI']),
    ('2017-06-03 15:00+08', 'Khalsa', null::smallint, null::smallint, 'unrecorded', array['KEANE', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'IAN VANDERPUT', 'JASMEET SINGH', 'EASHWAR', 'ZAKI', 'MARK CHEONG CHEE HAN', 'FAZLY', 'MARCUS', 'HANIF', 'YONG HOW ZHI', 'BRENNEN', 'AKASH PREBHASH CHANDRA', 'CALEB ANG', 'CHEE YONG', 'RYAN JAY NAIDU']),
    ('2017-06-18 15:00+08', 'SRC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AHMAD FARIS BIN MUHD JOHARI', 'AKASH PREBHASH CHANDRA', 'KEANE', 'MARCUS', 'CALEB ANG', 'IAN VANDERPUT', 'HANIF', 'CHEE YONG', 'HAO DUAN', 'RAMZI']),
    ('2017-06-21 15:00+08', 'CSC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'CHEE YONG', 'NICK', 'AHMAD FARIS BIN MUHD JOHARI', 'MARK CHEONG CHEE HAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AKASH PREBHASH CHANDRA', 'CALEB ANG', 'JASPAL SINGH GREWAL', 'IAN VANDERPUT', 'HANIF', 'AMOS']),
    ('2017-06-24 15:00+08', 'Jansenites', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'NICK', 'AHMAD FARIS BIN MUHD JOHARI', 'ZAKI', 'BRENNEN', 'HAO DUAN', 'HANIF', 'MARCUS', 'MARK CHEONG CHEE HAN', 'AKASH PREBHASH CHANDRA', 'CALEB ANG', 'JASMEET SINGH', 'ALTON CHUA KAI CONG', 'DYLAN WANG']),
    ('2017-06-28 15:00+08', 'Tornados', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'NICK', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AHMAD FARIS BIN MUHD JOHARI', 'AMOS', 'ETHAN TAN', 'ZAKI', 'ISHWARPAL SINGH GREWAL', 'CHEE YONG', 'JASMEET SINGH', 'RAMZI']),
    ('2017-07-01 15:00+08', 'SRC', null::smallint, null::smallint, 'unrecorded', array['TIMOTHY', 'JASPAL SINGH GREWAL', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'KEANE', 'ZAKI', 'AKASH PREBHASH CHANDRA', 'CALEB ANG', 'KHAIRUL', 'FAZLY', 'JEREMY YEH BO HSIEN', 'HANIF', 'HAO DUAN', 'ADIB'])
    ) as t(game_date, opponent, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2017 caps sheet — scoreline and kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
