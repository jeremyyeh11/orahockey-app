-- =============================================================
-- ORA Hockey — 2022 season (MHL1) from the caps sheet
-- Source: "ORA caps - 2022 (done).csv" — who played each of the 4 league
-- games recorded for 2022, plus the scores (given by hand; 3W 1D 0L). No
-- goals / assists / cards / POTM / training attendance were recorded, no
-- kick-off times (15:00 is a placeholder), and no home/away.
--
-- Creates: a locked 2022 season (recorded_stats = appearances only), 4 past
-- players not yet in the app (Haikel, Fazly, Ifran, Marcus — inactive, first
-- names only), the 4 games with results, the 2022 squad and 65 caps (RSVP
-- 'attending' on each game). Sheet names mapped to players by hand (Boon =
-- Tay Boon Kai, Bapit = Hafiz, Jeremy = Jeremy Yeh, Nat Goh = Nathaniel Goh,
-- Tim = Timothy, Ethan = Ethan Tan, Naidu = Ryan Jay Naidu). The sheet's
-- headers have no opponent for 17/7 and 3/7: they are SCC and Jansenites by
-- the order the scores were given (18 Jun, 3 Jul, 15 Jul, 17 Jul). Ish is
-- listed twice for 3/7: counted once.
--
-- Re-run safe: does nothing if a 2022 season already exists.
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
  if exists (select 1 from seasons where label = '2022') then
    raise notice '2022 season already exists — skipping';
    return;
  end if;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2022', '2022-01-01', '2022-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, null, false, 'player'
  from (values ('HAIKEL'), ('FAZLY'), ('IFRAN'), ('MARCUS')) as n(full_name)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2022-06-18 15:00+08', 'Hollandse', 2, 0, 'win', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'ALTON CHUA KAI CONG', 'JEREMY YEH BO HSIEN', 'NATHANIEL GOH', 'HAIKEL', 'AKASH PREBHASH CHANDRA', 'ETHAN TAN', 'KHAIRUL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'HARSHEN KOBAN', 'MARCUS', 'ADAM', 'TIMOTHY', 'RYAN JAY NAIDU', 'HIREN KOBAN', 'IFRAN']),
    ('2022-07-03 15:00+08', 'Jansenites', 1, 1, 'tie', array['ASHWIN UNNITHAN', 'AKASH PREBHASH CHANDRA', 'ISHWARPAL SINGH GREWAL', 'ALTON CHUA KAI CONG', 'MAK RUI AN RYAN', 'BALRAJ', 'FAZLY', 'IFRAN', 'AHMAD FARIS BIN MUHD JOHARI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'JEREMY YEH BO HSIEN']),
    ('2022-07-15 15:00+08', 'Tornados', 2, 0, 'win', array['TAY BOON KAI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ALTON CHUA KAI CONG', 'NATHANIEL GOH', 'BALRAJ', 'JEREMY YEH BO HSIEN', 'AKASH PREBHASH CHANDRA', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'HIREN KOBAN', 'HARSHEN KOBAN', 'JASMEET SINGH', 'KHAIRUL', 'ADAM', 'ETHAN TAN', 'MARCUS', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'TIMOTHY', 'IFRAN']),
    ('2022-07-17 15:00+08', 'SCC', 3, 0, 'win', array['TAY BOON KAI', 'NATHANIEL GOH', 'HAIKEL', 'JASMEET SINGH', 'JEREMY YEH BO HSIEN', 'ISHWARPAL SINGH GREWAL', 'FAZLY', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KHAIRUL', 'HARSHEN KOBAN', 'AHMAD FARIS BIN MUHD JOHARI', 'TIMOTHY', 'ETHAN TAN', 'HIREN KOBAN', 'ADAM', 'RYAN JAY NAIDU', 'MUHAMAD RAZIQ BIN MOHD NOOR'])
    ) as t(game_date, opponent, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            'Imported from the 2022 caps sheet — kick-off time not recorded')
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
