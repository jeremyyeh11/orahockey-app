-- =============================================================
-- ORA Hockey — 2025 season (MHL1) from the caps sheet
-- Source: "ORA caps - 2025 (done).csv" — who played each of the 14 league
-- games, plus the scores. No goals / assists / cards / POTM / training
-- attendance were recorded for 2025, and no kick-off times (15:00 is a
-- placeholder, noted on each game).
--
-- Creates: a locked 2025 season, 8 past players (inactive) not yet in the
-- app, the 14 games with results, the 2025 squad and 243 caps (RSVP
-- 'attending' on each game). Sheet names mapped to players by hand
-- (Boon = Tay Boon Kai, Bapit = Hafiz, Naidu = Ryan Jay Naidu, Ethan.T =
-- Ethan Tan, Ethan.W = Ethan Wong). Bapit is listed twice for 15/6 Khalsa:
-- counted once.
--
-- Re-run safe: does nothing if a 2025 season already exists.
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
  if exists (select 1 from seasons where label = '2025') then
    raise notice '2025 season already exists — skipping';
    return;
  end if;

  insert into seasons (label, starts_on, ends_on, is_current, locked)
  values ('2025', '2025-01-01', '2025-12-31', false, false)
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('ADAM', null), ('BALRAJ', null), ('DANIEL XU', null), ('DANNY', null), ('GOUTHAM', null), ('TIMOTHY', null), ('ETHAN TAN', 'ETHAN T'), ('ETHAN WONG', 'ETHAN W')) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2025-05-15 15:00+08', 'Team HI', 4, 0, 'win', array['TAY BOON KAI', 'AJAY SHANMUGAM', 'HIREN KOBAN', 'ISHWARPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'PEH YU', 'AHMAD FARIS BIN MUHD JOHARI', 'JAYDON POH YI KAI', 'LIM JORIM', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AJIT SHANMUGAM', 'DANNY', 'LIM JOASH', 'JOSHUA POH YI BIN', 'RYAN JAY NAIDU', 'TIMOTHY', 'JASPAL SINGH GREWAL']),
    ('2025-03-22 15:00+08', 'Tornados', 4, 1, 'win', array['TAY BOON KAI', 'ETHAN TAN', 'HIREN KOBAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'PEH YU', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JAYDON POH YI KAI', 'LIM JORIM', 'JOSHUA POH YI BIN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'AHMAD FARIS BIN MUHD JOHARI', 'IAN VANDERPUT', 'LIM JOASH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'TIMOTHY']),
    ('2025-03-29 15:00+08', 'SAA', 2, 3, 'loss', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'AJAY SHANMUGAM', 'PEH YU', 'MARK CHEONG CHEE HAN', 'AHMAD FARIS BIN MUHD JOHARI', 'LIM JORIM', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'HIREN KOBAN', 'TIMOTHY', 'ADAM', 'AJIT SHANMUGAM', 'IAN VANDERPUT', 'RYAN JAY NAIDU', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB']),
    ('2025-04-05 15:00+08', 'Team HI', 2, 0, 'win', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'PEH YU', 'ETHAN WONG', 'LIM JORIM', 'AHMAD FARIS BIN MUHD JOHARI', 'HIREN KOBAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AJAY SHANMUGAM', 'JAYDON POH YI KAI', 'JOSHUA POH YI BIN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'IAN VANDERPUT', 'TIMOTHY', 'DANNY', 'GOUTHAM']),
    ('2025-04-12 15:00+08', 'Khalsa', 7, 1, 'win', array['JASMEET SINGH', 'JASPAL SINGH GREWAL', 'AJAY SHANMUGAM', 'PEH YU', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JAYDON POH YI KAI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'HIREN KOBAN', 'DANNY', 'IAN VANDERPUT', 'LIM JOASH', 'TIMOTHY', 'GOUTHAM', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2025-05-11 15:00+08', 'OVA-VJC', 3, 2, 'win', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'PEH YU', 'HIREN KOBAN', 'ETHAN TAN', 'LIM JORIM', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'JOSHUA POH YI BIN', 'RYAN JAY NAIDU', 'ADAM', 'IAN VANDERPUT', 'TIMOTHY', 'RYAN VIR SINGH SANDHU', 'DANIEL XU', 'GOUTHAM']),
    ('2025-05-24 15:00+08', 'SCC', 0, 3, 'loss', array['TAY BOON KAI', 'AJAY SHANMUGAM', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'MARK CHEONG CHEE HAN', 'PEH YU', 'HIREN KOBAN', 'LIM JORIM', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'DANNY', 'IAN VANDERPUT', 'RYAN JAY NAIDU', 'LIM JOASH', 'ETHAN WONG']),
    ('2025-05-25 15:00+08', 'Tornados', 5, 0, 'win', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'MARK CHEONG CHEE HAN', 'PEH YU', 'ETHAN TAN', 'LIM JORIM', 'JAYDON POH YI KAI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'HIREN KOBAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'IAN VANDERPUT', 'JOSHUA POH YI BIN', 'DANNY', 'TIMOTHY']),
    ('2025-06-08 15:00+08', 'Jansenites', 2, 2, 'tie', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'AJAY SHANMUGAM', 'PEH YU', 'MARK CHEONG CHEE HAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ALTON CHUA KAI CONG', 'LIM JORIM', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'HIREN KOBAN', 'IAN VANDERPUT', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'ADAM', 'JOSHUA POH YI BIN', 'DANNY']),
    ('2025-06-14 15:00+08', 'Jansenites', 3, 4, 'loss', array['SARTHAK BASAK', 'ISHWARPAL SINGH GREWAL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AJAY SHANMUGAM', 'PEH YU', 'ETHAN TAN', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'LIM JORIM', 'HIREN KOBAN', 'IAN VANDERPUT', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'DANNY', 'RYAN VIR SINGH SANDHU']),
    ('2025-06-15 15:00+08', 'Khalsa', 7, 1, 'win', array['ASHWIN UNNITHAN', 'ETHAN WONG', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'PEH YU', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'HIREN KOBAN', 'LIM JORIM', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'DANNY', 'IAN VANDERPUT', 'RYAN VIR SINGH SANDHU']),
    ('2025-06-21 15:00+08', 'SCC', 2, 4, 'loss', array['BALRAJ', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'ASHWIN UNNITHAN', 'DANNY', 'ETHAN WONG', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'HIREN KOBAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'LIM JOASH', 'LIM JORIM', 'MARK CHEONG CHEE HAN', 'PEH YU', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU']),
    ('2025-06-28 15:00+08', 'OVA-VJC', 7, 1, 'win', array['AJAY SHANMUGAM', 'BALRAJ', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'TAY BOON KAI', 'HIREN KOBAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JAYDON POH YI KAI', 'JEREMY YEH BO HSIEN', 'LIM JOASH', 'LIM JORIM', 'MARK CHEONG CHEE HAN', 'PEH YU', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'TIMOTHY']),
    ('2025-06-29 15:00+08', 'SAA', 2, 0, 'win', array['TAY BOON KAI', 'BALRAJ', 'JASPAL SINGH GREWAL', 'JEREMY YEH BO HSIEN', 'MARK CHEONG CHEE HAN', 'ISHWARPAL SINGH GREWAL', 'PEH YU', 'ALTON CHUA KAI CONG', 'LIM JORIM', 'HIREN KOBAN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'JAYDON POH YI KAI', 'AKASH PREBHASH CHANDRA', 'AJAY SHANMUGAM', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'RYAN JAY NAIDU', 'TIMOTHY', 'LIM JOASH'])
    ) as t(game_date, opponent, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2025 caps sheet — kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
