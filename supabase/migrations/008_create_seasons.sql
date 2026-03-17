CREATE TABLE IF NOT EXISTS seasons (
  id bigint generated always as identity primary key,
  name text not null,
  number int not null unique,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('upcoming','active','completed','archived')),
  champion_player_id bigint references players(id) on delete set null,
  config jsonb default '{}',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS seasons_status_idx ON seasons (status);
CREATE INDEX IF NOT EXISTS seasons_number_idx ON seasons (number);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- RLS: anyone reads, service_role writes
CREATE POLICY "Anyone can read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Service role manages seasons" ON seasons FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can insert seasons" ON seasons FOR INSERT TO authenticated WITH CHECK (true);
