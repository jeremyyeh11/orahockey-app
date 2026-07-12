-- =============================================================
-- ORA Hockey — 2026 season seed data (completed season backlog)
-- Uses the EXISTING players roster. Creates the team, assigns
-- players to it, then seeds the 14 real MHL1 2026 fixtures with
-- real results, fabricated per-player stats + attendance, weekly
-- trainings, and 3 polls (2 closed, 1 active).
-- Safe-guarded: aborts if teams table is not empty.
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

do $$
declare
  v_team   uuid;
  v_jeremy uuid;
  v_poll   uuid;
  g        record;
  p        record;
  v_scorer   uuid;
  v_assister uuid;
  v_gk       uuid;
  i        int;
begin
  if exists (select 1 from teams) then
    raise exception 'teams table is not empty — refusing to seed twice';
  end if;

  insert into teams (name, league, season)
  values ('ORA Hockey', 'MHL1', '2026')
  returning id into v_team;

  -- Assign the existing roster to the team
  update players set team_id = v_team where team_id is null;

  insert into player_whitelist (email)
  select email from players
  on conflict (email) do nothing;

  -- ── Games: real MHL1 2026 fixtures + results (ORA score first) ──
  insert into games (team_id, opponent, game_date, location, home_away, game_type, goals_for, goals_against, result) values
    (v_team, 'Team HI',    '2026-04-12 18:00+08', 'Sengkang Hockey Stadium (SK1)', 'home', 'regular', 8, 0, 'win'),
    (v_team, 'Tornados',   '2026-04-18 18:00+08', 'Sengkang Hockey Stadium (SK1)', 'away', 'regular', 1, 0, 'win'),
    (v_team, 'OVA-VJC',    '2026-04-19 16:30+08', 'Sengkang Hockey Stadium (SK2)', 'home', 'regular', 3, 2, 'win'),
    (v_team, 'Hollandse',  '2026-04-25 18:00+08', 'Sengkang Hockey Stadium (SK2)', 'away', 'regular', 6, 1, 'win'),
    (v_team, 'SAA',        '2026-05-09 18:00+08', 'Sengkang Hockey Stadium (SK2)', 'away', 'regular', 2, 1, 'win'),
    (v_team, 'Team HI',    '2026-05-10 19:30+08', 'Sengkang Hockey Stadium (SK1)', 'away', 'regular', 6, 0, 'win'),
    (v_team, 'Tornados',   '2026-05-16 15:00+08', 'Sengkang Hockey Stadium (SK1)', 'home', 'regular', 3, 0, 'win'),
    (v_team, 'Hollandse',  '2026-05-17 18:00+08', 'Sengkang Hockey Stadium (SK2)', 'home', 'regular', 3, 1, 'win'),
    (v_team, 'OVA-VJC',    '2026-05-23 19:30+08', 'Sengkang Hockey Stadium (SK2)', 'away', 'regular', 6, 0, 'win'),
    (v_team, 'SAA',        '2026-05-24 18:00+08', 'Sengkang Hockey Stadium (SK1)', 'home', 'regular', 3, 1, 'win'),
    (v_team, 'SCC',        '2026-05-30 15:00+08', 'Sengkang Hockey Stadium (SK1)', 'home', 'regular', 3, 3, 'tie'),
    (v_team, 'Jansenites', '2026-06-13 15:00+08', 'Sengkang Hockey Stadium (SK1)', 'home', 'regular', 0, 0, 'tie'),
    (v_team, 'SCC',        '2026-06-20 15:00+08', 'Sengkang Hockey Stadium (SK1)', 'away', 'regular', 2, 3, 'loss'),
    (v_team, 'Jansenites', '2026-06-27 15:00+08', 'Sengkang Hockey Stadium (SK1)', 'away', 'regular', 8, 2, 'win');

  -- ── Trainings: Wednesdays 20:00, late Jan → early Jun ─────
  insert into training_sessions (team_id, session_date, location)
  select v_team, d, 'Sengkang Hockey Stadium — Pitch 2'
  from generate_series(
    timestamptz '2026-01-28 20:00+08',
    timestamptz '2026-06-10 20:00+08',
    interval '7 days'
  ) d;

  -- ── Game attendance + stats ───────────────────────────────
  create temp table tally (
    player_id uuid primary key,
    goals     int not null default 0,
    assists   int not null default 0
  ) on commit drop;

  for g in select * from games loop
    -- attendance: ~78% attending / ~11% maybe / ~11% out
    for p in select id from players where is_active loop
      insert into attendance (player_id, session_id, session_type, status, responded_at)
      values (
        p.id, g.id, 'game',
        (case when random() < 0.78 then 'attending'
              when random() < 0.5  then 'maybe'
              else 'not_attending' end)::attendance_status,
        g.game_date - interval '2 days'
      );
    end loop;

    -- distribute goals_for among attending outfielders
    -- (unknown position counts as outfield; defenders score PCs too)
    truncate tally;
    for i in 1..coalesce(g.goals_for, 0) loop
      select a.player_id into v_scorer
      from attendance a
      join players pl on pl.id = a.player_id
      where a.session_id = g.id and a.session_type = 'game'
        and a.status = 'attending'
        and (pl.position is null or not (pl.position && array['GK']))
      order by random() limit 1;

      if v_scorer is null then continue; end if;

      insert into tally (player_id, goals) values (v_scorer, 1)
      on conflict (player_id) do update set goals = tally.goals + 1;

      -- ~70% of goals get an assist from another attending outfielder
      if random() < 0.7 then
        select a.player_id into v_assister
        from attendance a
        join players pl on pl.id = a.player_id
        where a.session_id = g.id and a.session_type = 'game'
          and a.status = 'attending'
          and (pl.position is null or not (pl.position && array['GK']))
          and a.player_id <> v_scorer
        order by random() limit 1;

        if v_assister is not null then
          insert into tally (player_id, assists) values (v_assister, 1)
          on conflict (player_id) do update set assists = tally.assists + 1;
        end if;
      end if;
    end loop;

    insert into player_stats (player_id, game_id, goals_fg, assists)
    select player_id, g.id, goals, assists from tally;

    -- goalkeeper of the day: clean sheet when goals_against = 0
    select a.player_id into v_gk
    from attendance a
    join players pl on pl.id = a.player_id
    where a.session_id = g.id and a.session_type = 'game'
      and a.status = 'attending'
      and pl.position && array['GK']
    order by random() limit 1;

    if v_gk is null then
      select id into v_gk from players where position && array['GK'] order by random() limit 1;
    end if;

    if v_gk is not null then
      insert into player_stats (player_id, game_id, clean_sheet)
      values (v_gk, g.id, coalesce(g.goals_against, 1) = 0)
      on conflict (player_id, game_id) do update set clean_sheet = excluded.clean_sheet;
    end if;
  end loop;

  -- ── Training attendance (~90% respond) ────────────────────
  for g in select id, session_date from training_sessions loop
    for p in select id from players where is_active loop
      if random() < 0.9 then
        insert into attendance (player_id, session_id, session_type, status, responded_at)
        values (
          p.id, g.id, 'training',
          (case when random() < 0.7 then 'attending'
                when random() < 0.5 then 'maybe'
                else 'not_attending' end)::attendance_status,
          g.session_date - interval '1 day'
        );
      end if;
    end loop;
  end loop;

  -- ── Polls ─────────────────────────────────────────────────
  select id into v_jeremy from players where email = 'jeremyyeh11@gmail.com';

  -- 1. closed: season dinner
  insert into polls (team_id, created_by, question, is_active, closes_at, created_at)
  values (v_team, v_jeremy, 'End-of-season dinner — which date works best?', false, '2026-07-01 23:59+08', '2026-06-20 12:00+08')
  returning id into v_poll;
  insert into poll_options (poll_id, label, sort_order) values
    (v_poll, 'Sat 18 Jul', 0),
    (v_poll, 'Sat 25 Jul', 1),
    (v_poll, 'Sat 1 Aug',  2);
  for p in select id from players loop
    if random() < 0.85 then
      insert into poll_votes (poll_id, poll_option_id, player_id, voted_at)
      values (v_poll, (select id from poll_options where poll_id = v_poll order by random() limit 1), p.id, '2026-06-25 20:00+08');
    end if;
  end loop;

  -- 2. closed: player of the season (top scorers filled in by admin later;
  --    options here are just seed placeholders drawn from the roster)
  insert into polls (team_id, created_by, question, is_active, closes_at, created_at)
  values (v_team, v_jeremy, 'Player of the Season 2026', false, '2026-06-25 23:59+08', '2026-06-15 12:00+08')
  returning id into v_poll;
  insert into poll_options (poll_id, label, sort_order)
  select v_poll, initcap(split_part(full_name, ' ', 1)) || ' ' || initcap(split_part(full_name, ' ', 2)), row_number() over () - 1
  from (select full_name from players where is_active order by random() limit 4) x;
  for p in select id from players loop
    if random() < 0.8 then
      insert into poll_votes (poll_id, poll_option_id, player_id, voted_at)
      values (v_poll, (select id from poll_options where poll_id = v_poll order by random() limit 1), p.id, '2026-06-20 20:00+08');
    end if;
  end loop;

  -- 3. active: next season training night
  insert into polls (team_id, created_by, question, is_active, closes_at, created_at)
  values (v_team, v_jeremy, 'Which night should we train next season?', true, '2026-07-31 23:59+08', '2026-07-05 12:00+08')
  returning id into v_poll;
  insert into poll_options (poll_id, label, sort_order) values
    (v_poll, 'Tuesday',   0),
    (v_poll, 'Wednesday', 1),
    (v_poll, 'Thursday',  2);
  for p in select id from players loop
    if random() < 0.6 then
      insert into poll_votes (poll_id, poll_option_id, player_id, voted_at)
      values (v_poll, (select id from poll_options where poll_id = v_poll order by random() limit 1), p.id, '2026-07-08 20:00+08');
    end if;
  end loop;
end $$;
