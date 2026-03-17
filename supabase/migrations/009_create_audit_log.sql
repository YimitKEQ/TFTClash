CREATE TABLE IF NOT EXISTS audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  target_type text,
  target_id text,
  details jsonb default '{}',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read audit log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role manages audit log" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
