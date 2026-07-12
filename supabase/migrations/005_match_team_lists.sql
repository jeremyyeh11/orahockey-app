-- 005_match_team_lists.sql
-- Run in Supabase SQL Editor

-- Add team list status to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS team_list_status text DEFAULT NULL;

-- Create match_team_lists table
CREATE TABLE IF NOT EXISTS match_team_lists (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id     uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  selected    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

-- Enable RLS
ALTER TABLE match_team_lists ENABLE ROW LEVEL SECURITY;

-- Players can read published team lists
CREATE POLICY "Players can read published team lists"
  ON match_team_lists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = match_team_lists.game_id
      AND games.team_list_status = 'published'
    )
  );

-- Admins can read and write all team lists
CREATE POLICY "Admins can manage team lists"
  ON match_team_lists FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
