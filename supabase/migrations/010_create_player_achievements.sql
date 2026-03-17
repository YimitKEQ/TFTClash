CREATE TABLE IF NOT EXISTS player_achievements (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  achievement_id text not null,
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold','legendary')),
  earned_at timestamptz default now(),
  season_id bigint references seasons(id) on delete set null,
  UNIQUE (player_id, achievement_id, tier)
);

CREATE INDEX IF NOT EXISTS player_achievements_player_idx ON player_achievements (player_id);
CREATE INDEX IF NOT EXISTS player_achievements_season_idx ON player_achievements (season_id);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read achievements" ON player_achievements FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert achievements" ON player_achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role manages achievements" ON player_achievements FOR ALL TO service_role USING (true) WITH CHECK (true);
