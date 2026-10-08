-- =============================================================
-- ORA Hockey — 2023 season (MHL1) from the caps sheet
-- Sources: "ORA caps - 2023 (done).csv" — who played each of the 10 league
-- games; the league's "FBT Men's Hockey League 1 2023 results" page — dates,
-- scores and home/away (8W 1D 1L). No goals, assists, cards, POTM or training
-- attendance were recorded, and no kick-off times (15:00 is a placeholder).
-- The sheet had no date for game 1 (v SCC, 19 Mar) and dated the Hollandse
-- game 26/3; the results page has it on 9 Jul, so that date is used.
--
-- Creates: a locked 2023 season (recorded_stats = appearances only), 3 past
-- players (Brennen, Khairul, Jim — inactive, first names only), the 10 games
-- with results, the 2023 squad and 167 caps (RSVP 'attending' on each game).
-- Sheet names mapped to players by hand (Boon = Tay Boon Kai, Bapit / bapit =
-- Hafiz, Naidu = Ryan Jay Naidu, Ethan.T = Ethan Tan, Ryan Mak = Mak Rui An
-- Ryan, Dutch = Hollandse, Jans = Jansenites; the two unlabelled June games
-- are Tornados, confirmed by the results page).
--
-- Re-run safe: does nothing if a 2023 season already exists.
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
  if exists (select 1 from seasons where label = '2023') then
    raise notice '2023 season already exists — skipping';
    return;
  end if;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2023', '2023-01-01', '2023-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, null, false, 'player'
  from (values ('BRENNEN'), ('KHAIRUL'), ('JIM')) as n(full_name)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2023-03-19 15:00+08', 'SCC', 'home', 4, 3, 'win', array['TAY BOON KAI', 'ALTON CHUA KAI CONG', 'BALRAJ', 'BRENNEN', 'ISHWARPAL SINGH GREWAL', 'PEH YU', 'MAK RUI AN RYAN', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'KIEFER', 'KHAIRUL', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'RYAN JAY NAIDU']),
    ('2023-07-09 15:00+08', 'Hollandse', 'away', 5, 0, 'win', array['TAY BOON KAI', 'ALTON CHUA KAI CONG', 'BALRAJ', 'BRENNEN', 'ISHWARPAL SINGH GREWAL', 'MATTEUS OOI YIYANG', 'MAK RUI AN RYAN', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'HIREN KOBAN', 'JASMEET SINGH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'GOUTHAM', 'HARSHEN KOBAN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'RYAN JAY NAIDU']),
    ('2023-04-08 15:00+08', 'Jansenites', 'away', 2, 1, 'win', array['ASHWIN UNNITHAN', 'ALTON CHUA KAI CONG', 'HIREN KOBAN', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'JASPAL SINGH GREWAL', 'PEH YU', 'AKASH PREBHASH CHANDRA', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'KHAIRUL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'GOUTHAM', 'HARSHEN KOBAN', 'RYAN JAY NAIDU', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2023-04-16 15:00+08', 'Hollandse', 'home', 6, 0, 'win', array['TAY BOON KAI', 'ALTON CHUA KAI CONG', 'BRENNEN', 'JASMEET SINGH', 'JOSHUA POH YI BIN', 'MATTEUS OOI YIYANG', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JIM', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'HARSHEN KOBAN', 'ADAM', 'ETHAN TAN', 'GOUTHAM', 'KIEFER', 'RYAN JAY NAIDU']),
    ('2023-05-28 15:00+08', 'Khalsa', 'away', 6, 1, 'win', array['ASHWIN UNNITHAN', 'TAY BOON KAI', 'ALTON CHUA KAI CONG', 'BALRAJ', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'MATTEUS OOI YIYANG', 'PEH YU', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'KHAIRUL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'GOUTHAM', 'KIEFER', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2023-06-11 15:00+08', 'Jansenites', 'home', 2, 7, 'loss', array['TAY BOON KAI', 'ALTON CHUA KAI CONG', 'BALRAJ', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'MARK CHEONG CHEE HAN', 'PEH YU', 'AKASH PREBHASH CHANDRA', 'BRENNEN', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'GOUTHAM', 'HIREN KOBAN', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2023-06-17 15:00+08', 'Tornados', 'home', 4, 1, 'win', array['ASHWIN UNNITHAN', 'TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'BRENNEN', 'PEH YU', 'BALRAJ', 'JASMEET SINGH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KHAIRUL', 'AKASH PREBHASH CHANDRA', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'HIREN KOBAN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM', 'ADAM', 'MAK RUI AN RYAN']),
    ('2023-06-25 15:00+08', 'Tornados', 'away', 10, 1, 'win', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'BRENNEN', 'PEH YU', 'BALRAJ', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KHAIRUL', 'AKASH PREBHASH CHANDRA', 'AHMAD FARIS BIN MUHD JOHARI', 'HIREN KOBAN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM', 'ADAM', 'MAK RUI AN RYAN', 'ETHAN TAN']),
    ('2023-07-02 15:00+08', 'Khalsa', 'home', 5, 3, 'win', array['ADAM', 'AKASH PREBHASH CHANDRA', 'BALRAJ', 'TAY BOON KAI', 'BRENNEN', 'AHMAD FARIS BIN MUHD JOHARI', 'GOUTHAM', 'ISHWARPAL SINGH GREWAL', 'KHAIRUL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'MAK RUI AN RYAN', 'RYAN JAY NAIDU', 'PEH YU', 'MATTEUS OOI YIYANG']),
    ('2023-07-08 15:00+08', 'SCC', 'away', 4, 4, 'tie', array['TAY BOON KAI', 'BALRAJ', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'BRENNEN', 'PEH YU', 'MAK RUI AN RYAN', 'KHAIRUL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AKASH PREBHASH CHANDRA', 'AHMAD FARIS BIN MUHD JOHARI', 'JOSHUA POH YI BIN', 'ETHAN TAN', 'GOUTHAM', 'RYAN JAY NAIDU', 'ADAM', 'DANIEL XU', 'HIREN KOBAN'])
    ) as t(game_date, opponent, home_away, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, home_away, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, g.home_away, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2023 caps sheet (who played) and the league results page (dates, scores) — kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
