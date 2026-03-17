-- Create tournament_results table for per-player placement data
CREATE TABLE IF NOT EXISTS tournament_results (
  id bigint generated always as identity primary key,
  tournament_id bigint references tournaments(id) on delete cascade,
  player_id bigint,
  player_name text,
  final_placement int,
  total_points int,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournament results"
  ON tournament_results FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tournament results"
  ON tournament_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournament results"
  ON tournament_results FOR UPDATE
  TO authenticated
  USING (true);
