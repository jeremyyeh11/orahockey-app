-- =============================================================
-- ORA Hockey — Initial Schema
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- =============================================================

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- HELPER: is the current user an admin?
-- ─────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from players
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────
create table teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  league      text not null default 'MHL1',
  season      text not null,
  created_at  timestamptz not null default now()
);

alter table teams enable row level security;

create policy "Admins have full access to teams"
  on teams for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view teams"
  on teams for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- PLAYER WHITELIST
-- ─────────────────────────────────────────
create table player_whitelist (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  added_at   timestamptz not null default now()
);

alter table player_whitelist enable row level security;

create policy "Admins have full access to player_whitelist"
  on player_whitelist for all
  using (is_admin())
  with check (is_admin());

-- ─────────────────────────────────────────
-- PLAYERS
-- ─────────────────────────────────────────
create type player_role as enum ('admin', 'player');
create type player_position as enum ('F', 'D', 'G');

create table players (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  team_id       uuid references teams(id) on delete set null,
  full_name     text not null,
  jersey_number smallint,
  position      player_position,
  email         text not null unique,
  role          player_role not null default 'player',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table players enable row level security;

create policy "Admins have full access to players"
  on players for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view all players"
  on players for select
  using (auth.role() = 'authenticated');

create policy "Players can update their own record"
  on players for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ─────────────────────────────────────────
-- GAMES
-- ─────────────────────────────────────────
create type game_type as enum ('regular', 'playoff', 'exhibition');
create type game_result as enum ('win', 'loss', 'tie', 'ot_win', 'ot_loss');

create table games (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid references teams(id) on delete cascade,
  opponent        text not null,
  game_date       timestamptz not null,
  location        text,
  home_away       text check (home_away in ('home', 'away')),
  game_type       game_type not null default 'regular',
  goals_for       smallint,
  goals_against   smallint,
  result          game_result,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table games enable row level security;

create policy "Admins have full access to games"
  on games for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view games"
  on games for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- TRAINING SESSIONS
-- ─────────────────────────────────────────
create table training_sessions (
  id            uuid primary key default uuid_generate_v4(),
  team_id       uuid references teams(id) on delete cascade,
  session_date  timestamptz not null,
  location      text,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table training_sessions enable row level security;

create policy "Admins have full access to training_sessions"
  on training_sessions for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view training_sessions"
  on training_sessions for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────
create type attendance_status as enum ('attending', 'not_attending', 'maybe');
create type session_type as enum ('game', 'training');

create table attendance (
  id             uuid primary key default uuid_generate_v4(),
  player_id      uuid not null references players(id) on delete cascade,
  session_id     uuid not null,
  session_type   session_type not null,
  status         attendance_status not null,
  responded_at   timestamptz not null default now(),
  unique (player_id, session_id, session_type)
);

alter table attendance enable row level security;

create policy "Admins have full access to attendance"
  on attendance for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view attendance"
  on attendance for select
  using (auth.role() = 'authenticated');

create policy "Players can insert own attendance"
  on attendance for insert
  with check (
    player_id = (
      select id from players where auth_user_id = auth.uid()
    )
  );

create policy "Players can update own attendance"
  on attendance for update
  using (
    player_id = (
      select id from players where auth_user_id = auth.uid()
    )
  )
  with check (
    player_id = (
      select id from players where auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- POLLS
-- ─────────────────────────────────────────
create table polls (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid references teams(id) on delete cascade,
  created_by   uuid references players(id) on delete set null,
  question     text not null,
  is_active    boolean not null default true,
  closes_at    timestamptz,
  created_at   timestamptz not null default now()
);

alter table polls enable row level security;

create policy "Admins have full access to polls"
  on polls for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view active polls"
  on polls for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- POLL OPTIONS
-- ─────────────────────────────────────────
create table poll_options (
  id        uuid primary key default uuid_generate_v4(),
  poll_id   uuid not null references polls(id) on delete cascade,
  label     text not null,
  sort_order smallint not null default 0
);

alter table poll_options enable row level security;

create policy "Admins have full access to poll_options"
  on poll_options for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view poll_options"
  on poll_options for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- POLL VOTES
-- ─────────────────────────────────────────
create table poll_votes (
  id             uuid primary key default uuid_generate_v4(),
  poll_id        uuid not null references polls(id) on delete cascade,
  poll_option_id uuid not null references poll_options(id) on delete cascade,
  player_id      uuid not null references players(id) on delete cascade,
  voted_at       timestamptz not null default now(),
  unique (poll_id, player_id)  -- one vote per player per poll
);

alter table poll_votes enable row level security;

create policy "Admins have full access to poll_votes"
  on poll_votes for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view poll_votes"
  on poll_votes for select
  using (auth.role() = 'authenticated');

create policy "Players can insert own vote"
  on poll_votes for insert
  with check (
    player_id = (
      select id from players where auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- PLAYER STATS
-- ─────────────────────────────────────────
create table player_stats (
  id             uuid primary key default uuid_generate_v4(),
  player_id      uuid not null references players(id) on delete cascade,
  game_id        uuid not null references games(id) on delete cascade,
  goals          smallint not null default 0,
  assists        smallint not null default 0,
  penalty_min    smallint not null default 0,
  plus_minus     smallint not null default 0,
  shots          smallint not null default 0,
  -- Goalie fields (nullable for skaters)
  saves          smallint,
  goals_against  smallint,
  created_at     timestamptz not null default now(),
  unique (player_id, game_id)
);

alter table player_stats enable row level security;

create policy "Admins have full access to player_stats"
  on player_stats for all
  using (is_admin())
  with check (is_admin());

create policy "Players can view player_stats"
  on player_stats for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index idx_players_auth_user_id  on players (auth_user_id);
create index idx_players_team_id       on players (team_id);
create index idx_games_team_id         on games (team_id);
create index idx_games_game_date       on games (game_date);
create index idx_attendance_player_id  on attendance (player_id);
create index idx_attendance_session    on attendance (session_id, session_type);
create index idx_poll_votes_poll_id    on poll_votes (poll_id);
create index idx_player_stats_player   on player_stats (player_id);
create index idx_player_stats_game     on player_stats (game_id);
