-- 006_player_profile_fields.sql
-- Run in Supabase SQL Editor

-- date_of_birth already exists on the players table (added via drift)
-- Just add joined_year if it doesn't exist
ALTER TABLE players ADD COLUMN IF NOT EXISTS joined_year smallint;
