-- =============================================================
-- Player of the Match placings (1st/2nd/3rd, shared places allowed)
-- Applied to live DB on 2026-07-12 (migration: potm_awards)
-- Points (3/2/1) are derived in the app, not stored. A future voting
-- system will populate this table instead of manual entry.
-- =============================================================

create table potm (
  id         uuid primary key default uuid_generate_v4(),
  game_id    uuid not null references games(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  place      smallint not null check (place between 1 and 3),
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

alter table potm enable row level security;

create policy "Admins have full access to potm"
  on potm for all using (is_admin()) with check (is_admin());
create policy "Players can view potm"
  on potm for select using (auth.role() = 'authenticated');

create index idx_potm_game on potm (game_id);
