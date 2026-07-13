-- 007_match_results.sql
-- Update-match-result feature (backlog #4):
--   * match_goals  — one row per goal we scored, chronological (goal_number 1..goals_for)
--   * match_cards  — one row per card; game_id NULL = legacy card with no match attribution
--   * set_match_score()      — any signed-in player can enter the final score of a played match
--   * reorder_match_goals()  — renumber goal rows after a drag re-order
--   * player_stats stays in sync with goal rows via trigger (FG/PC/PS/assists; clean_sheet untouched)
--   * Backfills goal rows for the seeded 2026 season from player_stats
--   * Seeds the previously hardcoded card data (was CARD_DATA in lib/stats.ts)
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

create table if not exists match_goals (
  id               uuid primary key default uuid_generate_v4(),
  game_id          uuid not null references games(id) on delete cascade,
  goal_number      smallint not null check (goal_number >= 1),
  scorer_id        uuid not null references players(id) on delete cascade,
  -- Assist slot: 'pc'/'ps' mark a penalty-corner/penalty-stroke goal (no player assist),
  -- 'player' means assist_player_id assisted a field goal, NULL = unassisted field goal.
  assist_kind      text check (assist_kind in ('player', 'pc', 'ps')),
  assist_player_id uuid references players(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (game_id, goal_number)
);

create index if not exists idx_match_goals_game on match_goals (game_id);

create table if not exists match_cards (
  id          uuid primary key default uuid_generate_v4(),
  game_id     uuid references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  card_type   text not null check (card_type in ('green', 'yellow', 'red')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_match_cards_game on match_cards (game_id);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────

alter table match_goals enable row level security;
alter table match_cards enable row level security;

create policy "Players can view match_goals"
  on match_goals for select using (auth.role() = 'authenticated');
create policy "Players can view match_cards"
  on match_cards for select using (auth.role() = 'authenticated');

-- Any signed-in player can record goals/cards, but only for matches already played
create policy "Players can insert goals for played matches"
  on match_goals for insert
  with check (
    auth.uid() is not null
    and exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  );
create policy "Players can update goals for played matches"
  on match_goals for update
  using (
    auth.uid() is not null
    and exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  )
  with check (
    exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  );
create policy "Players can delete goals for played matches"
  on match_goals for delete
  using (
    auth.uid() is not null
    and exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  );

create policy "Players can insert cards for played matches"
  on match_cards for insert
  with check (
    auth.uid() is not null
    and game_id is not null
    and exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  );
create policy "Players can delete cards for played matches"
  on match_cards for delete
  using (
    auth.uid() is not null
    and game_id is not null
    and exists (select 1 from games g where g.id = game_id and g.game_date <= now())
  );

create policy "Admins have full access to match_goals"
  on match_goals for all using (is_admin()) with check (is_admin());
create policy "Admins have full access to match_cards"
  on match_cards for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────

-- games UPDATE is admin-only under RLS, so score entry by players runs as definer.
create or replace function set_match_score(p_game_id uuid, p_goals_for int, p_goals_against int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_goals_for is null or p_goals_against is null
     or p_goals_for not between 0 and 99 or p_goals_against not between 0 and 99 then
    raise exception 'Invalid score';
  end if;
  if not exists (select 1 from games where id = p_game_id and game_date <= now()) then
    raise exception 'Match has not been played yet';
  end if;

  update games set
    goals_for = p_goals_for,
    goals_against = p_goals_against,
    result = (case
      when p_goals_for > p_goals_against then 'win'
      when p_goals_for < p_goals_against then 'loss'
      else 'tie'
    end)::game_result
  where id = p_game_id;

  -- Lowering the score drops scorer rows beyond the new total
  delete from match_goals where game_id = p_game_id and goal_number > p_goals_for;
end;
$$;

-- Renumber goal rows in one call (the unique (game_id, goal_number) constraint
-- makes row-by-row renumbering from the client impossible).
create or replace function reorder_match_goals(p_game_id uuid, p_goal_ids uuid[], p_numbers int[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if array_length(p_goal_ids, 1) is distinct from array_length(p_numbers, 1) then
    raise exception 'Mismatched arrays';
  end if;
  if not exists (select 1 from games where id = p_game_id and game_date <= now()) then
    raise exception 'Match has not been played yet';
  end if;

  -- Move the rows out of the way, then assign final numbers
  update match_goals set goal_number = goal_number + 1000
  where game_id = p_game_id and id = any(p_goal_ids);

  for i in 1 .. coalesce(array_length(p_goal_ids, 1), 0) loop
    update match_goals set goal_number = p_numbers[i]
    where id = p_goal_ids[i] and game_id = p_game_id;
  end loop;
end;
$$;

-- Recompute player_stats (FG/PC/PS/assists) for one game from its goal rows.
-- clean_sheet is preserved; players whose goal rows were removed are zeroed, not deleted.
create or replace function sync_player_stats_for_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into player_stats (player_id, game_id, goals_fg, goals_pc, goals_ps, assists)
  select ids.player_id, p_game_id,
         coalesce(s.fg, 0), coalesce(s.pc, 0), coalesce(s.ps, 0), coalesce(a.n, 0)
  from (
    select scorer_id as player_id from match_goals where game_id = p_game_id
    union
    select assist_player_id from match_goals where game_id = p_game_id and assist_player_id is not null
    union
    select player_id from player_stats where game_id = p_game_id
  ) ids
  left join (
    select scorer_id,
           count(*) filter (where assist_kind is null or assist_kind = 'player') as fg,
           count(*) filter (where assist_kind = 'pc') as pc,
           count(*) filter (where assist_kind = 'ps') as ps
    from match_goals where game_id = p_game_id
    group by scorer_id
  ) s on s.scorer_id = ids.player_id
  left join (
    select assist_player_id, count(*) as n
    from match_goals where game_id = p_game_id and assist_player_id is not null
    group by assist_player_id
  ) a on a.assist_player_id = ids.player_id
  on conflict (player_id, game_id) do update set
    goals_fg = excluded.goals_fg,
    goals_pc = excluded.goals_pc,
    goals_ps = excluded.goals_ps,
    assists  = excluded.assists;
end;
$$;

create or replace function trg_match_goals_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sync_player_stats_for_game(coalesce(new.game_id, old.game_id));
  return null;
end;
$$;

-- ─────────────────────────────────────────
-- BACKFILL goal rows for played games from player_stats
-- (runs BEFORE the sync trigger is created, so seeded stats are the source)
-- ─────────────────────────────────────────

do $$
declare
  g record;
  st record;
  i int;
  n int;
  target uuid;
begin
  for g in select id from games where result is not null loop
    -- Skip games that already have goal rows (re-run safety)
    if exists (select 1 from match_goals where game_id = g.id) then
      continue;
    end if;

    n := 0;
    for st in
      select player_id, goals_fg, goals_pc, goals_ps
      from player_stats
      where game_id = g.id and (goals_fg > 0 or goals_pc > 0 or goals_ps > 0)
      order by player_id
    loop
      for i in 1 .. coalesce(st.goals_pc, 0) loop
        n := n + 1;
        insert into match_goals (game_id, goal_number, scorer_id, assist_kind)
        values (g.id, n, st.player_id, 'pc');
      end loop;
      for i in 1 .. coalesce(st.goals_ps, 0) loop
        n := n + 1;
        insert into match_goals (game_id, goal_number, scorer_id, assist_kind)
        values (g.id, n, st.player_id, 'ps');
      end loop;
      for i in 1 .. coalesce(st.goals_fg, 0) loop
        n := n + 1;
        insert into match_goals (game_id, goal_number, scorer_id)
        values (g.id, n, st.player_id);
      end loop;
    end loop;

    -- Attach recorded assists to field-goal rows (prefer a different scorer's goal).
    -- Verified against seed data: assists <= field goals in every played game.
    for st in
      select player_id, assists
      from player_stats
      where game_id = g.id and assists > 0
      order by player_id
    loop
      for i in 1 .. st.assists loop
        select id into target from match_goals
        where game_id = g.id and assist_kind is null and scorer_id <> st.player_id
        order by goal_number
        limit 1;
        if target is null then
          select id into target from match_goals
          where game_id = g.id and assist_kind is null
          order by goal_number
          limit 1;
        end if;
        if target is not null then
          update match_goals
          set assist_kind = 'player', assist_player_id = st.player_id
          where id = target;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Now that the backfill matches player_stats exactly, keep them in sync going forward
drop trigger if exists match_goals_sync on match_goals;
create trigger match_goals_sync
  after insert or update or delete on match_goals
  for each row execute function trg_match_goals_sync();

-- ─────────────────────────────────────────
-- SEED legacy card data (was hardcoded as CARD_DATA in lib/stats.ts).
-- No per-match attribution — game_id NULL, dated mid-season 2026.
-- ─────────────────────────────────────────

insert into match_cards (game_id, player_id, card_type, created_at)
select null, p.id, c.card_type, '2026-06-01T12:00:00+08'::timestamptz
from (values
  ('HIREN KOBAN', 'green'),
  ('HIREN KOBAN', 'green'),
  ('ISHWARPAL SINGH GREWAL', 'yellow'),
  ('JASMEET SINGH', 'green'),
  ('JASPAL SINGH GREWAL', 'green'),
  ('JAYDON POH YI KAI', 'yellow'),
  ('JEREMY YEH BO HSIEN', 'green'),
  ('LIM JORIM', 'green'),
  ('PEH YU', 'green'),
  ('MOHAMED RIFQI BIN MOHAMED RAFIK ALKHATIB', 'green'),
  ('RYAN VIR SINGH SANDHU', 'green')
) as c(full_name, card_type)
join players p on p.full_name = c.full_name
where not exists (select 1 from match_cards where game_id is null);
