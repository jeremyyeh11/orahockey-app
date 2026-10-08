-- =============================================================
-- ORA Hockey — 2019 season (National Hockey League 1) from the caps sheet
-- Sources: "ORA caps - 2019 (done).csv" — who played each of the 12 league
-- games; the league's "National Hockey League 1 results" page — dates,
-- opponents, scores and home/away (10W 1D 1L). No goals / assists / cards /
-- POTM / training attendance were recorded, and no kick-off times (15:00 is
-- a placeholder). The sheet dated the Tornados game 24/5; the results page
-- has it on 26 May, so that date is used.
--
-- Creates: a locked 2019 season (recorded_stats = appearances only), two
-- opponents (SRC, Eagles-HI — a different club from Team HI), 7 past players
-- not yet in the app (Nick, Keane, Zaki, Justin, Hanif, Hao Duan, Yong How
-- Zhi — inactive, mostly first names only), the 12 games with results, the
-- 2019 squad and 214 caps (RSVP 'attending' on each game). Sheet names mapped to
-- players by hand (Hafiz = Muhammad Hafiz, Jeremy = Jeremy Yeh, Tim =
-- Timothy, Ian = Ian Vanderput, Kevin = Kevin K Saji, Naidu = Ryan Jay
-- Naidu, How Zhi = Yong How Zhi).
--
-- Re-run safe: does nothing if a 2019 season already exists.
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
  if exists (select 1 from seasons where label = '2019') then
    raise notice '2019 season already exists — skipping';
    return;
  end if;

  insert into opponents (short_name, full_name)
  values ('SRC', 'Singapore Recreation Club'), ('Eagles-HI', 'Eagles-HI')
  on conflict (short_name) do nothing;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2019', '2019-01-01', '2019-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('NICK', null), ('KEANE', null), ('ZAKI', null), ('JUSTIN', null), ('HANIF', null), ('HAO DUAN', null), ('YONG HOW ZHI', 'HOW ZHI')) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2019-02-24 15:00+08', 'SRC', 'home', 3, 0, 'win', array['NICK', 'ASHWIN UNNITHAN', 'JASPAL SINGH GREWAL', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'JUSTIN', 'ZAKI', 'HAIKEL', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'KHAIRUL', 'AHMAD FARIS BIN MUHD JOHARI', 'ALTON CHUA KAI CONG', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'GOUTHAM', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MARCUS']),
    ('2019-03-09 15:00+08', 'SCC', 'home', 4, 2, 'win', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'HAIKEL', 'JUSTIN', 'ZAKI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AKASH PREBHASH CHANDRA', 'KEVIN K SAJI', 'KHAIRUL', 'IAN VANDERPUT', 'ADAM', 'YONG HOW ZHI', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'TIMOTHY']),
    ('2019-03-10 15:00+08', 'Eagles-HI', 'home', 2, 1, 'win', array['NICK', 'KEANE', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'ZAKI', 'JUSTIN', 'JEREMY YEH BO HSIEN', 'JASMEET SINGH', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'HAIKEL', 'KHAIRUL', 'TIMOTHY', 'MARCUS', 'YONG HOW ZHI', 'ADAM', 'AHMAD FARIS BIN MUHD JOHARI']),
    ('2019-03-30 15:00+08', 'Eagles-HI', 'away', 2, 1, 'win', array['ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'ZAKI', 'MARK CHEONG CHEE HAN', 'HAO DUAN', 'JUSTIN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AKASH PREBHASH CHANDRA', 'KEVIN K SAJI', 'KHAIRUL', 'YONG HOW ZHI', 'MARCUS', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'IAN VANDERPUT', 'TIMOTHY', 'ADAM', 'KEANE']),
    ('2019-03-31 15:00+08', 'Jansenites', 'home', 3, 2, 'win', array['NICK', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JASMEET SINGH', 'MARK CHEONG CHEE HAN', 'HAIKEL', 'JEREMY YEH BO HSIEN', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AKASH PREBHASH CHANDRA', 'KHAIRUL', 'YONG HOW ZHI', 'MARCUS', 'TIMOTHY', 'RYAN JAY NAIDU', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'ADAM']),
    ('2019-04-06 15:00+08', 'Tornados', 'away', 2, 2, 'tie', array['KEANE', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'ALTON CHUA KAI CONG', 'JEREMY YEH BO HSIEN', 'HAO DUAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'AKASH PREBHASH CHANDRA', 'KEVIN K SAJI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'TIMOTHY', 'AHMAD FARIS BIN MUHD JOHARI', 'IAN VANDERPUT', 'YONG HOW ZHI', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'ADAM']),
    ('2019-04-07 15:00+08', 'Jansenites', 'away', 6, 2, 'win', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'JEREMY YEH BO HSIEN', 'JUSTIN', 'HAIKEL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'AHMAD FARIS BIN MUHD JOHARI', 'TIMOTHY', 'YONG HOW ZHI', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'RYAN JAY NAIDU', 'IAN VANDERPUT']),
    ('2019-05-04 15:00+08', 'SCC', 'away', 1, 3, 'loss', array['NICK', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'ZAKI', 'JUSTIN', 'HAIKEL', 'AKASH PREBHASH CHANDRA', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'JASMEET SINGH', 'KHAIRUL', 'ALTON CHUA KAI CONG', 'IAN VANDERPUT', 'ADAM', 'YONG HOW ZHI', 'TIMOTHY', 'RYAN JAY NAIDU', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2019-05-05 15:00+08', 'Khalsa', 'away', 2, 1, 'win', array['ASHWIN UNNITHAN', 'MARK CHEONG CHEE HAN', 'JASPAL SINGH GREWAL', 'ZAKI', 'JEREMY YEH BO HSIEN', 'TIMOTHY', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'KHAIRUL', 'HANIF', 'HAIKEL', 'YONG HOW ZHI', 'ADAM', 'RYAN JAY NAIDU', 'MARCUS', 'KEVIN K SAJI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ISHWARPAL SINGH GREWAL']),
    ('2019-05-12 15:00+08', 'SRC', 'away', 4, 3, 'win', array['KEANE', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'JEREMY YEH BO HSIEN', 'JUSTIN', 'HAIKEL', 'ALTON CHUA KAI CONG', 'HANIF', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'KHAIRUL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'TIMOTHY', 'MARCUS', 'KEVIN K SAJI', 'YONG HOW ZHI', 'ADAM']),
    ('2019-05-26 15:00+08', 'Tornados', 'home', 2, 0, 'win', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'HAIKEL', 'JUSTIN', 'ALTON CHUA KAI CONG', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KHAIRUL', 'TIMOTHY', 'MARCUS', 'AHMAD FARIS BIN MUHD JOHARI', 'RYAN JAY NAIDU', 'KEVIN K SAJI', 'GOUTHAM']),
    ('2019-06-02 15:00+08', 'Khalsa', 'home', 6, 1, 'win', array['NICK', 'KEANE', 'ISHWARPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'MARK CHEONG CHEE HAN', 'HAIKEL', 'JASMEET SINGH', 'AKASH PREBHASH CHANDRA', 'HANIF', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KHAIRUL', 'ADAM', 'GOUTHAM', 'RYAN JAY NAIDU', 'AHMAD FARIS BIN MUHD JOHARI', 'YONG HOW ZHI'])
    ) as t(game_date, opponent, home_away, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, home_away, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, g.home_away, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2019 caps sheet (who played) and the league results page (dates, scores) — kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
