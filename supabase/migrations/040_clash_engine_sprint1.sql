-- supabase/migrations/040_clash_engine_sprint1.sql

-- 1. Add Riot ID columns to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_na text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_eu text;

-- 2. Add is_admin column to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE players SET is_admin = true WHERE id = 1;

-- 3. NOTE: `server` is NOT a DB column -- it lives inside the tournamentState JSON blob
-- stored in site_settings (key='tournament_state'). No ALTER TABLE needed here.
-- The admin sets it via setTournamentState({ server: 'EU' }) which AppContext auto-persists.

-- 4. Create pending_results table
CREATE TABLE IF NOT EXISTS pending_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id),
  round integer NOT NULL,
  lobby_number integer NOT NULL,
  player_id integer REFERENCES players(id),
  placement integer NOT NULL CHECK (placement BETWEEN 1 AND 8),
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
  UNIQUE (tournament_id, round, player_id)
);

CREATE INDEX IF NOT EXISTS pending_results_lookup
  ON pending_results (tournament_id, round, lobby_number);

ALTER TABLE pending_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players insert own pending_results"
  ON pending_results FOR INSERT
  WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY "players read own pending_results"
  ON pending_results FOR SELECT
  USING (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY "admin full access pending_results"
  ON pending_results
  USING (EXISTS (
    SELECT 1 FROM players
    WHERE auth_user_id = auth.uid() AND is_admin = true
  ));

-- 5. Atomic player stats increment RPC
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_player_id integer,
  p_pts integer,
  p_wins integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET
    season_pts = COALESCE(season_pts, 0) + p_pts,
    wins = COALESCE(wins, 0) + p_wins
  WHERE id = p_player_id;
END;
$$;
