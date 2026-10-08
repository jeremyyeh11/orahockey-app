-- =============================================================
-- ORA Hockey — 2024 goal scorers and Man of the Match
-- Source: per-game scorers + MOTM sent by Jeremy (Oct 2026), in results
-- order, matched to the games by score. No goal types or assists were
-- recorded: goals are assist_kind 'unrecorded' (migration 024), and the
-- season's recorded_stats is {goals, potm}.
--
-- Also: three caps the sheet missed (a scorer/MOTM not listed as playing):
-- Dany 19/5 Khalsa, Timothy 7/7 SAA, Ezec 12/5 SAA; and "Danny" renamed to
-- Dany Ilyas bin Ramlee.
--
-- Re-run safe: skips games that already have goals / POTM.
-- Run in: Supabase Dashboard → SQL Editor (or via MCP) — as the database
-- owner, so the archived-season lock doesn't apply.
-- =============================================================

update players set full_name = 'DANY ILYAS BIN RAMLEE', preferred_name = 'DANY'
where full_name = 'DANNY' and auth_user_id is null;

-- Caps the sheet missed
insert into attendance (player_id, session_id, session_type, status)
select p.id, g.id, 'game', 'attending'
from (values ('2024-05-19', 'DANY ILYAS BIN RAMLEE'), ('2024-07-07', 'TIMOTHY'), ('2024-05-12', 'MOHAMMAD EZECKIEL')) v(d, name)
join (select g.id, (g.game_date at time zone 'Asia/Singapore')::date::text as d from games g join seasons s on s.id = g.season_id where s.label = '2024') g on g.d = v.d join players p on p.full_name = v.name
on conflict (player_id, session_id, session_type) do nothing;

-- Goals (type and assist not recorded); the match_goals trigger syncs player_stats
insert into match_goals (game_id, goal_number, scorer_id, assist_kind)
select g.id, v.n, p.id, 'unrecorded'
from (values
    ('2024-03-16', 1, 'RYAN JAY NAIDU'),
    ('2024-03-16', 2, 'AHMAD FARIS BIN MUHD JOHARI'),
    ('2024-04-13', 1, 'AHMAD FARIS BIN MUHD JOHARI'),
    ('2024-04-13', 2, 'ISHWARPAL SINGH GREWAL'),
    ('2024-04-13', 3, 'LIM JOASH'),
    ('2024-04-13', 4, 'ALTON CHUA KAI CONG'),
    ('2024-04-13', 5, 'TIMOTHY'),
    ('2024-05-18', 1, 'TIMOTHY'),
    ('2024-05-18', 2, 'JASPAL SINGH GREWAL'),
    ('2024-05-18', 3, 'ALTON CHUA KAI CONG'),
    ('2024-05-19', 1, 'MUHAMAD RAZIQ BIN MOHD NOOR'),
    ('2024-05-19', 2, 'ALTON CHUA KAI CONG'),
    ('2024-05-19', 3, 'RYAN JAY NAIDU'),
    ('2024-05-19', 4, 'DANY ILYAS BIN RAMLEE'),
    ('2024-05-19', 5, 'JASPAL SINGH GREWAL'),
    ('2024-06-08', 1, 'ISHWARPAL SINGH GREWAL'),
    ('2024-06-09', 1, 'JASPAL SINGH GREWAL'),
    ('2024-06-09', 2, 'MUHAMAD RAZIQ BIN MOHD NOOR'),
    ('2024-06-09', 3, 'ADAM'),
    ('2024-06-09', 4, 'ETHAN TAN'),
    ('2024-06-09', 5, 'LIM JOASH'),
    ('2024-06-09', 6, 'ISHWARPAL SINGH GREWAL'),
    ('2024-06-29', 1, 'ALTON CHUA KAI CONG'),
    ('2024-06-29', 2, 'ALTON CHUA KAI CONG'),
    ('2024-06-29', 3, 'MUHAMAD RAZIQ BIN MOHD NOOR'),
    ('2024-05-12', 1, 'ALTON CHUA KAI CONG'),
    ('2024-07-06', 1, 'AHMAD FARIS BIN MUHD JOHARI'),
    ('2024-07-07', 1, 'TIMOTHY'),
    ('2024-07-07', 2, 'DANY ILYAS BIN RAMLEE'),
    ('2024-07-07', 3, 'ALTON CHUA KAI CONG'),
    ('2024-07-07', 4, 'ALTON CHUA KAI CONG'),
    ('2024-07-07', 5, 'MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB')
) v(d, n, name)
join (select g.id, (g.game_date at time zone 'Asia/Singapore')::date::text as d from games g join seasons s on s.id = g.season_id where s.label = '2024') g on g.d = v.d join players p on p.full_name = v.name
where not exists (select 1 from match_goals m where m.game_id = g.id and m.goal_number = v.n);

-- Man of the Match (1st place only)
insert into potm (game_id, player_id, place)
select g.id, p.id, 1
from (values
    ('2024-04-13', 'LIM JOASH'),
    ('2024-05-18', 'MOHAMMAD EZECKIEL'),
    ('2024-05-19', 'MUHAMAD RAZIQ BIN MOHD NOOR'),
    ('2024-06-09', 'MUHAMAD RAZIQ BIN MOHD NOOR'),
    ('2024-06-29', 'ALTON CHUA KAI CONG'),
    ('2024-05-12', 'MOHAMMAD EZECKIEL'),
    ('2024-07-06', 'AHMAD FARIS BIN MUHD JOHARI'),
    ('2024-07-07', 'DANY ILYAS BIN RAMLEE')
) v(d, name)
join (select g.id, (g.game_date at time zone 'Asia/Singapore')::date::text as d from games g join seasons s on s.id = g.season_id where s.label = '2024') g on g.d = v.d join players p on p.full_name = v.name
where not exists (select 1 from potm x where x.game_id = g.id);
