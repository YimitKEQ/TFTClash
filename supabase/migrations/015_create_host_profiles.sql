CREATE TABLE IF NOT EXISTS host_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  org_name text not null,
  slug text not null unique,
  logo_url text,
  banner_url text,
  brand_color text default '#9B72CF',
  bio text default '',
  rules_text text default '',
  social_links jsonb default '{}',
  sponsor_logos jsonb default '[]',
  verified boolean default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  applied_at timestamptz default now(),
  approved_at timestamptz,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS host_profiles_slug_idx ON host_profiles (slug);
CREATE INDEX IF NOT EXISTS host_profiles_user_idx ON host_profiles (user_id);
CREATE INDEX IF NOT EXISTS host_profiles_status_idx ON host_profiles (status);

ALTER TABLE host_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved host profiles" ON host_profiles FOR SELECT USING (status = 'approved' OR auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON host_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON host_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages host profiles" ON host_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
