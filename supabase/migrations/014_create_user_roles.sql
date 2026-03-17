CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player','pro','host','admin')),
  granted_at timestamptz default now(),
  granted_by uuid references auth.users(id) on delete set null
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own role" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages roles" ON user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Allow admins to read all roles (checked in app logic)
CREATE POLICY "Authenticated can read roles" ON user_roles FOR SELECT TO authenticated USING (true);
