-- =============================================================
-- ORA Hockey — 2018 season (National Hockey League 1) from the caps sheet
-- Source: "ORA caps - 2018 (done).csv" — who played each of the 10 league
-- games. Scores come from the league's weekend reviews, so far only seven:
-- Khalsa 1–2 ORA (3–4 Mar), ORA 2–2 Eagles-PV (10–11 Mar), Tornados 2–6 ORA
-- (24–25 Mar), ORA 2–0 Khalsa (7–8 Apr), SCC 3–1 ORA (5–6 May), Eagles-PV
-- 3–3 ORA (12–13 May), ORA 2–2 Tornados (19–20 May). The reviews also give home/away. Every other game has no
-- scoreline (result 'unrecorded': counts as played for caps, no score or
-- W-D-L — migration 025). Update the rows here as more reviews turn up. No goals / assists /
-- cards / POTM / training attendance were recorded, and no kick-off times
-- (15:00 is a placeholder).
--
-- Creates: a locked 2018 season (recorded_stats = appearances only), one
-- opponent (Eagles-PV — the sheet's "PV"), 8 past players not yet in the app
-- (Caleb Ang, Adib, Amos, Chee Yong "CY", Eashwar, Aqil, Amirul Afiq,
-- Zhykry — inactive), the 10 games, the 2018 squad and 178 caps (RSVP
-- 'attending' on each game). Sheet names mapped to players by hand (Boon =
-- Tay Boon Kai, Bapit = Hafiz, Naidu = Ryan Jay Naidu, Kevin = Kevin K Saji,
-- Ian = Ian Vanderput, Cy = Chee Yong).
--
-- Re-run safe: does nothing if a 2018 season already exists.
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
  if exists (select 1 from seasons where label = '2018') then
    raise notice '2018 season already exists — skipping';
    return;
  end if;

  insert into opponents (short_name, full_name)
  values ('Eagles-PV', 'Eagles-PV')
  on conflict (short_name) do nothing;

  insert into seasons (label, starts_on, ends_on, is_current, locked, recorded_stats)
  values ('2018', '2018-01-01', '2018-12-31', false, false, '{}')
  returning id into v_season;

  -- Past players not yet in the app: inactive, so they don't join the current squad
  insert into players (team_id, full_name, preferred_name, is_active, role)
  select v_team, n.full_name, n.preferred, false, 'player'
  from (values ('CALEB ANG', null), ('ADIB', null), ('AMOS', null), ('CHEE YONG', 'CY'), ('EASHWAR', null), ('AQIL', null), ('AMIRUL AFIQ', null), ('ZHYKRY', null)) as n(full_name, preferred)
  where not exists (select 1 from players p where p.full_name = n.full_name);

  for g in
    select * from (values
    ('2018-02-24 15:00+08', 'SCC', null, null::smallint, null::smallint, 'unrecorded', array['NICK', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'CALEB ANG', 'ALTON CHUA KAI CONG', 'ZAKI', 'JASMEET SINGH', 'HANIF', 'AHMAD FARIS BIN MUHD JOHARI', 'AKASH PREBHASH CHANDRA', 'KEVIN K SAJI', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADIB', 'AMOS', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM', 'ADAM', 'IAN VANDERPUT']),
    ('2018-03-04 15:00+08', 'Khalsa', 'away', 2, 1, 'win', array['NICK', 'MARK CHEONG CHEE HAN', 'CHEE YONG', 'ISHWARPAL SINGH GREWAL', 'CALEB ANG', 'ALTON CHUA KAI CONG', 'FAZLY', 'AMIRUL AFIQ', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'BRENNEN', 'JASMEET SINGH', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AKASH PREBHASH CHANDRA', 'AHMAD FARIS BIN MUHD JOHARI', 'IAN VANDERPUT', 'AMOS', 'RYAN JAY NAIDU', 'ADAM']),
    ('2018-03-10 15:00+08', 'Eagles-PV', 'home', 2, 2, 'tie', array['TAY BOON KAI', 'ISHWARPAL SINGH GREWAL', 'FAZLY', 'CHEE YONG', 'ALTON CHUA KAI CONG', 'CALEB ANG', 'AQIL', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'KEVIN K SAJI', 'HANIF', 'ZHYKRY', 'IAN VANDERPUT', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM', 'RYAN JAY NAIDU', 'ADAM']),
    ('2018-03-25 15:00+08', 'Tornados', 'away', 6, 2, 'win', array['TAY BOON KAI', 'CALEB ANG', 'JUSTIN', 'ZAKI', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'EASHWAR', 'AKASH PREBHASH CHANDRA', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'KEVIN K SAJI', 'RYAN JAY NAIDU', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'AHMAD FARIS BIN MUHD JOHARI', 'IAN VANDERPUT', 'ADAM', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM']),
    ('2018-04-08 15:00+08', 'Khalsa', 'home', 2, 0, 'win', array['NICK', 'MARK CHEONG CHEE HAN', 'EASHWAR', 'ISHWARPAL SINGH GREWAL', 'ALTON CHUA KAI CONG', 'JUSTIN', 'FAZLY', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'HANIF', 'AKASH PREBHASH CHANDRA', 'KEVIN K SAJI', 'JASMEET SINGH', 'AHMAD FARIS BIN MUHD JOHARI', 'RYAN JAY NAIDU', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ADIB', 'ZHYKRY']),
    ('2018-05-05 15:00+08', 'SCC', 'away', 1, 3, 'loss', array['NICK', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ZAKI', 'ISHWARPAL SINGH GREWAL', 'JASMEET SINGH', 'IAN VANDERPUT', 'AMIRUL AFIQ', 'MARK CHEONG CHEE HAN', 'FAZLY', 'KEVIN K SAJI', 'AHMAD FARIS BIN MUHD JOHARI', 'EASHWAR', 'RYAN JAY NAIDU', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'GOUTHAM', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG']),
    ('2018-05-13 15:00+08', 'Eagles-PV', 'away', 3, 3, 'tie', array['NICK', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'CALEB ANG', 'FAZLY', 'EASHWAR', 'ZAKI', 'ALTON CHUA KAI CONG', 'JASMEET SINGH', 'AKASH PREBHASH CHANDRA', 'RYAN JAY NAIDU', 'AHMAD FARIS BIN MUHD JOHARI', 'IAN VANDERPUT', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'ADAM', 'GOUTHAM', 'AMIRUL AFIQ', 'ADIB']),
    ('2018-05-19 15:00+08', 'Tornados', 'home', 2, 2, 'tie', array['TAY BOON KAI', 'JUSTIN', 'CALEB ANG', 'ISHWARPAL SINGH GREWAL', 'MARK CHEONG CHEE HAN', 'CHEE YONG', 'EASHWAR', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'ALTON CHUA KAI CONG', 'JASMEET SINGH', 'AKASH PREBHASH CHANDRA', 'GOUTHAM', 'ADAM', 'ADIB', 'IAN VANDERPUT', 'AHMAD FARIS BIN MUHD JOHARI', 'AMIRUL AFIQ']),
    ('2018-06-03 15:00+08', 'Jansenites', null, null::smallint, null::smallint, 'unrecorded', array['TAY BOON KAI', 'CALEB ANG', 'MARK CHEONG CHEE HAN', 'ISHWARPAL SINGH GREWAL', 'FAZLY', 'CHEE YONG', 'JUSTIN', 'AKASH PREBHASH CHANDRA', 'ALTON CHUA KAI CONG', 'KEVIN K SAJI', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'JASMEET SINGH', 'ADAM', 'IAN VANDERPUT', 'RYAN JAY NAIDU', 'AMIRUL AFIQ', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'GOUTHAM']),
    ('2018-06-09 15:00+08', 'Jansenites', null, null::smallint, null::smallint, 'unrecorded', array['NICK', 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'MARK CHEONG CHEE HAN', 'ADIB', 'ISHWARPAL SINGH GREWAL', 'MUHAMMAD HAFIZ BIN ABDUL RASED', 'ZAKI', 'GOUTHAM', 'ADAM', 'AHMAD FARIS BIN MUHD JOHARI', 'JASMEET SINGH', 'FAZLY', 'EASHWAR', 'ALTON CHUA KAI CONG', 'AKASH PREBHASH CHANDRA', 'MUHAMAD RAZIQ BIN MOHD NOOR', 'RYAN JAY NAIDU'])
    ) as t(game_date, opponent, home_away, goals_for, goals_against, result, played)
  loop
    select string_agg(n, ', ') into missing from unnest(g.played) n where not exists (select 1 from players p where p.full_name = n);
    if missing is not null then raise exception 'Unknown players: %', missing; end if;

    insert into games (team_id, season_id, opponent, game_date, home_away, game_type, goals_for, goals_against, result, notes)
    values (v_team, v_season, g.opponent, g.game_date::timestamptz, g.home_away, 'regular', g.goals_for, g.goals_against, g.result::game_result,
            case when g.result = 'unrecorded'
                 then 'Imported from the 2018 caps sheet — scoreline and kick-off time not recorded'
                 else 'Imported from the 2018 caps sheet (who played) and the league weekend review (score) — kick-off time not recorded' end)
    returning id into v_game;

    insert into season_players (season_id, player_id)
    select v_season, p.id from players p where p.full_name = any(g.played)
    on conflict do nothing;

    insert into attendance (player_id, session_id, session_type, status)
    select p.id, v_game, 'game', 'attending' from players p where p.full_name = any(g.played);
  end loop;

  update seasons set locked = true where id = v_season;
end $$;
