-- =============================================================
-- ORA Hockey — 2016 season (National Hockey League 1) from the caps sheet
-- Source: "ORA caps - 2016 (Done).csv" — who played each of the 14 league
-- games. No scores were recorded (result 'unrecorded': counts as played for
-- caps, no score or W-D-L — migration 025), and no home/away, goals /
-- assists / cards / POTM / training attendance, or kick-off times (15:00 is
-- a placeholder). Two games (17 Jul, 31 Jul) have no opponent on the sheet:
-- they are 'Unknown' until someone finds out. Update the game rows here if
-- opponents or results turn up.
--
-- Creates: a locked 2016 season (recorded_stats = appearances only), one
-- opponent (Jansenites A — the sheet's "Jans A", kept apart from plain
-- Jansenites), 9 past players not yet in the app (Hari Shoran, Hari.R,
-- Hakiim, Iliya, Siva, Eugene, Acap, Benjamin Ang, Benjy — inactive, first
-- names / sheet names only), the 14 games, the 2016 squad and 219 caps (RSVP
-- 'attending' on each game). Sheet names mapped to players by hand (Boon is
-- not in 2016; How Zhi = Yong How Zhi, Hari.S = Hari Shoran, Ethan.T =
-- Ethan Tan, Dylan.W = Dylan Wang, Naidu = Ryan Jay Naidu, Dutch Club =
-- Hollandse, Jans = Jansenites). Benjamin Ang and Benjy are different people.
--
-- Re-run safe: does nothing if a 2016 season already exists.
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
  if exists (select 1 from seasons where label = '2016') then
    raise notice '2016 season already exists — skipping';
    return;
  end if;

  insert into opponents (short_name, full_name)
  values ('Jansenites A', 'Jansenites Hockey Club A')
  on conflict (short_name) do nothing;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2016', '2016-01-01', '2016-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('HARI SHORAN', null), ('HARI.R', null), ('HAKIIM', null), ('ILIYA', null), ('SIVA', null), ('EUGENE', null), ('ACAP', null), ('BENJAMIN ANG', null), ('BENJY', null)) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2016-04-23 15:00+08', 'Tornados', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['FAZLY', 'HARI SHORAN', 'NICK', 'MARK CHEONG CHEE HAN', 'HAKIIM', 'ILIYA', 'HANIF', 'JEREMY YEH BO HSIEN', 'YONG HOW ZHI', 'HAO DUAN', 'KEANE', 'BRENNEN', 'MARCUS', 'RYAN JAY NAIDU', 'HARI.R']),
    ('2016-05-07 15:00+08', 'Hollandse', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MARK CHEONG CHEE HAN', 'SIVA', 'KEANE', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'YONG HOW ZHI', 'JEREMY YEH BO HSIEN', 'HAO DUAN', 'BRENNEN', 'HARI SHORAN', 'ADIB', 'HANIF', 'FAZLY', 'ZAKI', 'EUGENE', 'ILIYA', 'ACAP', 'MARCUS', 'NICK']),
    ('2016-05-14 15:00+08', 'Jansenites A', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MARK CHEONG CHEE HAN', 'JEREMY YEH BO HSIEN', 'EUGENE', 'KEANE', 'HARI SHORAN', 'HAO DUAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'BRENNEN', 'ADIB', 'BENJAMIN ANG', 'MARCUS', 'FAZLY', 'HARI.R', 'ACAP', 'NICK', 'ZAKI', 'HANIF', 'BENJY']),
    ('2016-06-19 15:00+08', 'Khalsa', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['YONG HOW ZHI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'NICK', 'HARI.R', 'JEREMY YEH BO HSIEN', 'ZAKI', 'HANIF', 'ADIB', 'MARK CHEONG CHEE HAN', 'ASHWIN UNNITHAN', 'HARI SHORAN', 'MARCUS', 'BENJAMIN ANG', 'FAZLY']),
    ('2016-06-26 15:00+08', 'Jansenites', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'NICK', 'ETHAN TAN', 'ADIB', 'FAZLY', 'ZAKI', 'HARI.R', 'HARI SHORAN', 'ALTON CHUA KAI CONG', 'AKASH PREBHASH CHANDRA', 'HAKIIM']),
    ('2016-07-03 15:00+08', 'SCC', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['DYLAN WANG', 'JEREMY YEH BO HSIEN', 'MARCUS', 'HAO DUAN', 'FAZLY', 'KEANE', 'BRENNEN', 'ASHWIN UNNITHAN', 'NICK', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ZAKI', 'HARI.R', 'ADIB', 'HANIF', 'RYAN JAY NAIDU']),
    ('2016-07-09 15:00+08', 'SCC', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['HARI.R', 'JEREMY YEH BO HSIEN', 'HANIF', 'ZAKI', 'YONG HOW ZHI', 'ADIB', 'NICK', 'FAZLY', 'MARCUS', 'KEANE', 'DYLAN WANG', 'BENJY', 'HAO DUAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'BRENNEN', 'ALTON CHUA KAI CONG', 'ETHAN TAN']),
    ('2016-07-17 15:00+08', 'Unknown', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — opponent, scoreline and kick-off time not recorded', array['BENJAMIN ANG', 'NICK', 'MARK CHEONG CHEE HAN', 'KEANE', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'YONG HOW ZHI', 'DYLAN WANG', 'BRENNEN', 'BENJY', 'JEREMY YEH BO HSIEN', 'HAO DUAN', 'ADIB', 'ZAKI', 'ILIYA', 'HANIF', 'SIVA', 'FAZLY']),
    ('2016-07-23 15:00+08', 'Jansenites', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MARK CHEONG CHEE HAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'NICK', 'KEANE', 'MARCUS', 'JEREMY YEH BO HSIEN', 'SIVA', 'BRENNEN', 'ADIB', 'BENJAMIN ANG', 'AKASH PREBHASH CHANDRA', 'HAKIIM', 'HARI.R', 'HANIF', 'ILIYA', 'FAZLY', 'BENJY']),
    ('2016-07-31 15:00+08', 'Unknown', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — opponent, scoreline and kick-off time not recorded', array['ZAKI', 'YONG HOW ZHI', 'MARK CHEONG CHEE HAN', 'HAKIIM', 'ADIB', 'BRENNEN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'HANIF', 'ILIYA', 'NICK', 'KEANE', 'MARCUS']),
    ('2016-08-13 15:00+08', 'Khalsa', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADIB', 'MARK CHEONG CHEE HAN', 'HAKIIM', 'NICK', 'ILIYA', 'YONG HOW ZHI', 'JEREMY YEH BO HSIEN', 'HAO DUAN', 'BENJAMIN ANG', 'BENJY', 'KEANE', 'MARCUS', 'BRENNEN', 'FAZLY', 'HANIF']),
    ('2016-08-20 15:00+08', 'Hollandse', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['JEREMY YEH BO HSIEN', 'SIVA', 'MARK CHEONG CHEE HAN', 'ADIB', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'NICK', 'KEANE', 'ZAKI', 'ILIYA', 'MARCUS', 'HAO DUAN', 'HANIF', 'BRENNEN', 'FAZLY', 'HARI.R', 'BENJAMIN ANG']),
    ('2016-08-27 15:00+08', 'SCC', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MARK CHEONG CHEE HAN', 'YONG HOW ZHI', 'MARCUS', 'JEREMY YEH BO HSIEN', 'KEANE', 'NICK', 'HAO DUAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'FAZLY', 'ADIB', 'HAKIIM', 'HARI.R', 'BENJY', 'BRENNEN', 'ACAP']),
    ('2016-09-03 15:00+08', 'Jansenites A', null::smallint, null::smallint, 'unrecorded', 'Imported from the 2016 caps sheet — scoreline and kick-off time not recorded', array['MARK CHEONG CHEE HAN', 'KEANE', 'YONG HOW ZHI', 'BENJAMIN ANG', 'HANIF', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'FAZLY', 'ADIB', 'JEREMY YEH BO HSIEN', 'NICK', 'ZAKI', 'BRENNEN', 'BENJY', 'MARCUS', 'EUGENE', 'HAKIIM', 'HARI.R', 'ILIYA'])
    ) as t(game_date, opponent, goals_for, goals_against, result, notes, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, 'regular', g.goals_for, g.goals_against, g.result::game_result, g.notes)
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
