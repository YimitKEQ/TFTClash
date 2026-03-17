-- Create tournaments table for host-created events
CREATE TABLE IF NOT EXISTS tournaments (
  id bigint generated always as identity primary key,
  name text not null,
  date date not null,
  phase text not null default 'upcoming',
  format text,
  size int default 8,
  host_user_id uuid references auth.users(id),
  invite_only boolean default false,
  entry_fee text,
  rules text,
  prize_pool text,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournaments"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (true);
