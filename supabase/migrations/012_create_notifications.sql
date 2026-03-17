CREATE TABLE IF NOT EXISTS notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info' check (type in ('info','success','warning','clash','achievement','system')),
  title text not null,
  message text,
  read boolean default false,
  action_url text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages notifications" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
