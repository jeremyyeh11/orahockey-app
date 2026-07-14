-- 008_potm_vote.sql
-- Vote-POTM system (backlog #5). Replaces admin-only manual `potm` entry with a
-- match-linked, secret, rank-based vote that auto-creates when a match is over and
-- auto-closes once every listed player has voted. The tally (3/2/1 points) populates
-- the existing `potm` table (places 1/2/3, shared places on ties) so season stats
-- keep deriving from it unchanged.
--
--   * potm_polls    — one open/closed poll per played match with a published team list
--   * potm_votes    — SECRET ranked ballots (1st/2nd/3rd); never client-readable
--   * potm_ballots  — PUBLIC receipt (who has voted, not their choices); drives the
--                     live "not-yet-voted" tags via Realtime
--   * ensure_potm_polls()  — lazily create polls on Polls-tab load
--   * cast_potm_vote()     — eligibility-checked, atomic ballot + receipt, auto-close
--   * close_potm_poll()    — tally 3/2/1 into `potm`; auto (all voted) or admin force
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

create table if not exists potm_polls (
  id         uuid primary key default uuid_generate_v4(),
  game_id    uuid not null references games(id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz,
  unique (game_id)
);

create index if not exists idx_potm_polls_game on potm_polls (game_id);

-- Secret ranked ballots. Only definer functions and admins ever read these; the
-- per-voter choices stay hidden until the poll closes and the result is derived.
create table if not exists potm_votes (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references potm_polls(id) on delete cascade,
  voter_id   uuid not null references players(id) on delete cascade,
  first_id   uuid not null references players(id) on delete cascade,
  second_id  uuid not null references players(id) on delete cascade,
  third_id   uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

create index if not exists idx_potm_votes_poll on potm_votes (poll_id);

-- Public receipt: who has voted, without exposing their choices. Kept separate from
-- potm_votes precisely so "who voted" can be world-readable (and Realtime-broadcast)
-- while the ranked ballots remain secret.
create table if not exists potm_ballots (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references potm_polls(id) on delete cascade,
  voter_id   uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

create index if not exists idx_potm_ballots_poll on potm_ballots (poll_id);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────

alter table potm_polls enable row level security;
alter table potm_votes enable row level security;
alter table potm_ballots enable row level security;

-- Polls: everyone signed in can see them; only definer/admin create/close.
create policy "Players can view potm_polls"
  on potm_polls for select using (auth.role() = 'authenticated');
create policy "Admins have full access to potm_polls"
  on potm_polls for all using (is_admin()) with check (is_admin());

-- Votes: SECRET. No player-facing select — the ballots are only ever read by the
-- definer tally. Admins retain full access for support/debugging.
create policy "Admins have full access to potm_votes"
  on potm_votes for all using (is_admin()) with check (is_admin());

-- Ballots (receipt): any signed-in player can see who has voted (needed for the live
-- not-yet-voted tags). Writes go through cast_potm_vote() (definer), not directly.
create policy "Players can view potm_ballots"
  on potm_ballots for select using (auth.role() = 'authenticated');
create policy "Admins have full access to potm_ballots"
  on potm_ballots for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────

-- Lazily create an open poll for every played match that has a published team list
-- and no poll yet. Called when the Polls tab loads (no scheduler in this project).
create or replace function ensure_potm_polls()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into potm_polls (game_id)
  select g.id
  from games g
  where g.game_date <= now()
    and g.team_list_status = 'published'
    and exists (select 1 from match_team_lists m where m.game_id = g.id)
    and not exists (select 1 from potm_polls p where p.game_id = g.id)
  on conflict (game_id) do nothing;
end;
$$;

-- Tally 3/2/1 points from the secret ballots and write the placings into `potm`.
-- Runs when the last eligible voter votes (via cast_potm_vote) or when an admin
-- force-closes. dense_rank keeps shared places on ties, capped at places 1..3.
create or replace function close_potm_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game     uuid;
  v_eligible int;
  v_voted    int;
begin
  select game_id into v_game from potm_polls where id = p_poll_id and status = 'open';
  if v_game is null then
    return; -- already closed or missing; nothing to do
  end if;

  select count(*) into v_eligible from match_team_lists where game_id = v_game;
  select count(*) into v_voted    from potm_ballots     where poll_id = p_poll_id;

  -- Only auto-close (everyone voted) or an admin force-close may proceed.
  if not is_admin() and v_voted < v_eligible then
    raise exception 'Poll cannot be closed until everyone has voted';
  end if;

  update potm_polls set status = 'closed', closed_at = now() where id = p_poll_id;

  -- Replace any prior placings for this match with the vote result.
  delete from potm where game_id = v_game;

  insert into potm (game_id, player_id, place)
  with points as (
    select first_id  as player_id, 3 as pts from potm_votes where poll_id = p_poll_id
    union all
    select second_id, 2 from potm_votes where poll_id = p_poll_id
    union all
    select third_id,  1 from potm_votes where poll_id = p_poll_id
  ),
  tallies as (
    select player_id, sum(pts) as total from points group by player_id
  ),
  ranked as (
    select player_id, dense_rank() over (order by total desc) as place from tallies
  )
  select v_game, player_id, place from ranked where place <= 3;
end;
$$;

-- Cast (and lock) a rank vote. All three placings are required, must be distinct,
-- and must be players on the match's published team list; the voter must be on that
-- list too. The ballot (secret) and receipt (public) are written atomically, then the
-- poll auto-closes if this was the final eligible voter.
create or replace function cast_potm_vote(p_poll_id uuid, p_first uuid, p_second uuid, p_third uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter    uuid;
  v_game     uuid;
  v_status   text;
  v_eligible int;
  v_voted    int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into v_voter from players where auth_user_id = auth.uid();
  if v_voter is null then
    raise exception 'No player record linked to this account';
  end if;

  select game_id, status into v_game, v_status from potm_polls where id = p_poll_id;
  if v_game is null then
    raise exception 'Poll not found';
  end if;
  if v_status <> 'open' then
    raise exception 'This poll is closed';
  end if;

  -- Voter must be on the published team list for this match.
  if not exists (
    select 1
    from match_team_lists mtl
    join games g on g.id = mtl.game_id
    where mtl.game_id = v_game
      and mtl.player_id = v_voter
      and g.team_list_status = 'published'
  ) then
    raise exception 'Only players on this match team list can vote';
  end if;

  if p_first is null or p_second is null or p_third is null then
    raise exception 'Select all three placings';
  end if;
  if p_first = p_second or p_first = p_third or p_second = p_third then
    raise exception 'Placings must be three different players';
  end if;
  if (
    select count(*) from match_team_lists
    where game_id = v_game and player_id in (p_first, p_second, p_third)
  ) <> 3 then
    raise exception 'Placings must be players on this match team list';
  end if;

  begin
    insert into potm_votes (poll_id, voter_id, first_id, second_id, third_id)
    values (p_poll_id, v_voter, p_first, p_second, p_third);
    insert into potm_ballots (poll_id, voter_id)
    values (p_poll_id, v_voter);
  exception
    when unique_violation then
      raise exception 'You have already voted in this poll';
  end;

  -- Auto-close once every listed player has voted.
  select count(*) into v_eligible from match_team_lists where game_id = v_game;
  select count(*) into v_voted    from potm_ballots     where poll_id = p_poll_id;
  if v_voted >= v_eligible then
    perform close_potm_poll(p_poll_id);
  end if;
end;
$$;

-- ─────────────────────────────────────────
-- REALTIME
-- Live not-yet-voted tags subscribe to potm_ballots inserts; the Polls tab also
-- watches potm_polls so an auto-close (status -> closed) surfaces results live.
-- ─────────────────────────────────────────

alter table potm_polls   replica identity full;
alter table potm_ballots replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'potm_ballots'
  ) then
    alter publication supabase_realtime add table potm_ballots;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'potm_polls'
  ) then
    alter publication supabase_realtime add table potm_polls;
  end if;
end;
$$;
