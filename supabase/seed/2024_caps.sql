-- =============================================================
-- ORA Hockey — 2024 season (MHL1) from the caps sheet
-- Source: "ORA caps - 2024 (DONE).csv" — who played each of the 10 league
-- games; scores supplied separately (in order, double-headers paired).
-- Appearances only (stats_recorded = false): no goals / assists / cards /
-- POTM; kick-off times are a 15:00 placeholder, noted on each game.
--
-- Creates: a locked 2024 season, 6 past players (inactive) not yet in the
-- app (Ezec, Harshen, Kiefer, Nat Goh, Nat Tan, Thievyan), the 10 games
-- (6W 2D 2L), the squad and 170 caps. Sheet → app: Saints = SAA,
-- jans = Jansenites, Ryan Mak = Mak Rui An Ryan (plus the 2025 mapping).
-- The sheet's 29/6 game had no opponent: it's the Jansenites 3-3 draw;
-- 12/5 SAA is the 1-0 win (results paired by double-header).
--
-- Re-run safe: does nothing if a 2024 season already exists.
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
  if exists (select 1 from seasons where label = '2024') then
    raise notice '2024 season already exists — skipping';
    return;
  end if;

  insert into seasons (label, starts_on, ends_on, is_current, locked, stats_recorded)
  values ('2024', '2024-01-01', '2024-12-31', false, false, false)
  returning id into v_season;

  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('EZEC', null), ('HARSHEN', null), ('KIEFER', null), ('NAT GOH', 'NAT GOH'), ('NAT TAN', 'NAT TAN'), ('THIEVYAN', null)) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2024-03-16 15:00+08', 'Tornados', 2, 1, 'win', array['ASHWIN UNNITHAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASPAL SINGH GREWAL', 'JASMEET SINGH', 'MARK CHEONG CHEE HAN', 'MAK RUI AN RYAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AHMAD FARIS BIN MUHD JOHARI', 'ALTON CHUA KAI CONG', 'JOSHUA POH YI BIN', 'PEH YU', 'ETHAN TAN', 'ADAM', 'KIEFER', 'RYAN JAY NAIDU', 'TIMOTHY', 'MUHAMAD RAZIQ BIN MOHD NOOR']),
    ('2024-04-13 15:00+08', 'Khalsa', 5, 2, 'win', array['ASHWIN UNNITHAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASPAL SINGH GREWAL', 'PEH YU', 'ETHAN WONG', 'MAK RUI AN RYAN', 'ISHWARPAL SINGH GREWAL', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ALTON CHUA KAI CONG', 'HIREN KOBAN', 'HARSHEN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'ETHAN TAN', 'GOUTHAM', 'TIMOTHY', 'AHMAD FARIS BIN MUHD JOHARI', 'LIM JOASH', 'DANNY']),
    ('2024-05-12 15:00+08', 'SAA', 1, 0, 'win', array['ASHWIN UNNITHAN', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'NAT GOH', 'PEH YU', 'MAK RUI AN RYAN', 'ALTON CHUA KAI CONG', 'HIREN KOBAN', 'JASMEET SINGH', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'HARSHEN', 'KIEFER', 'RYAN JAY NAIDU']),
    ('2024-05-18 15:00+08', 'SCC', 3, 3, 'tie', array['EZEC', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'PEH YU', 'ALTON CHUA KAI CONG', 'HARSHEN', 'HIREN KOBAN', 'NAT TAN', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'LIM JOASH', 'RYAN JAY NAIDU', 'TIMOTHY']),
    ('2024-05-19 15:00+08', 'Khalsa', 5, 2, 'win', array['EZEC', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'MAK RUI AN RYAN', 'THIEVYAN', 'ALTON CHUA KAI CONG', 'HARSHEN', 'HIREN KOBAN', 'JASMEET SINGH', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADAM', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'LIM JOASH', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'RYAN JAY NAIDU']),
    ('2024-06-08 15:00+08', 'SCC', 1, 6, 'loss', array['EZEC', 'BALRAJ', 'ETHAN WONG', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'MARK CHEONG CHEE HAN', 'PEH YU', 'ALTON CHUA KAI CONG', 'HIREN KOBAN', 'JOSHUA POH YI BIN', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ETHAN TAN', 'AHMAD FARIS BIN MUHD JOHARI', 'LIM JOASH', 'NAT TAN', 'RYAN JAY NAIDU']),
    ('2024-06-09 15:00+08', 'Tornados', 6, 1, 'win', array['ASHWIN UNNITHAN', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'JASMEET SINGH', 'ETHAN WONG', 'BALRAJ', 'ALTON CHUA KAI CONG', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'HIREN KOBAN', 'HARSHEN', 'AHMAD FARIS BIN MUHD JOHARI', 'ADAM', 'LIM JOASH', 'DANNY', 'NAT TAN', 'ETHAN TAN', 'RYAN JAY NAIDU']),
    ('2024-06-29 15:00+08', 'Jansenites', 3, 3, 'tie', array['ASHWIN UNNITHAN', 'JASPAL SINGH GREWAL', 'ISHWARPAL SINGH GREWAL', 'BALRAJ', 'PEH YU', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MAK RUI AN RYAN', 'ALTON CHUA KAI CONG', 'JASMEET SINGH', 'AHMAD FARIS BIN MUHD JOHARI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'AKASH PREBHASH CHANDRA', 'ADAM', 'RYAN JAY NAIDU', 'TIMOTHY', 'LIM JOASH', 'NAT TAN']),
    ('2024-07-06 15:00+08', 'Jansenites', 1, 3, 'loss', array['ADAM', 'AKASH PREBHASH CHANDRA', 'DANNY', 'ETHAN WONG', 'EZEC', 'AHMAD FARIS BIN MUHD JOHARI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ISHWARPAL SINGH GREWAL', 'JASPAL SINGH GREWAL', 'LIM JOASH', 'JOSHUA POH YI BIN', 'NAT TAN', 'PEH YU', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'TIMOTHY']),
    ('2024-07-07 15:00+08', 'SAA', 5, 1, 'win', array['ADAM', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'DANNY', 'ETHAN WONG', 'EZEC', 'AHMAD FARIS BIN MUHD JOHARI', 'JASMEET SINGH', 'JASPAL SINGH GREWAL', 'LIM JOASH', 'NAT TAN', 'PEH YU', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB'])
    ) as t(game_date, opponent, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2024 caps sheet — kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
