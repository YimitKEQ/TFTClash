CREATE TABLE IF NOT EXISTS season_snapshots (
  id bigint generated always as identity primary key,
  season_id bigint not null references seasons(id) on delete cascade,
  week_number int not null,
  standings jsonb not null,
  snapshot_date date not null default current_date,
  created_at timestamptz default now(),
  UNIQUE (season_id, week_number)
);

CREATE INDEX IF NOT EXISTS season_snapshots_season_week_idx ON season_snapshots (season_id, week_number);

ALTER TABLE season_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read snapshots" ON season_snapshots FOR SELECT USING (true);
CREATE POLICY "Service role manages snapshots" ON season_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can insert snapshots" ON season_snapshots FOR INSERT TO authenticated WITH CHECK (true);
