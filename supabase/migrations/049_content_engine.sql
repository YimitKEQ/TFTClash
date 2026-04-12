-- Content Engine: social media command center tables
-- Single-user (Lodie) access via RLS owner check

create table if not exists content_posts (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  platform text not null check (platform in ('twitter','reddit','medium','instagram')),
  content_type text not null,
  tone text not null,
  context text,
  generated_content text not null,
  edited_content text,
  status text default 'draft' check (status in ('draft','scheduled','posted','archived')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  engagement_notes text,
  tags text[],
  trend_snapshot jsonb,
  is_favorite boolean default false,
  score integer
);

create index if not exists content_posts_owner_idx on content_posts(owner_id, created_at desc);
create index if not exists content_posts_status_idx on content_posts(owner_id, status);

create table if not exists content_templates (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  name text not null,
  platform text not null,
  content_type text not null,
  tone text not null,
  template_prompt text not null,
  example_output text,
  use_count integer default 0
);

create table if not exists content_calendar (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  time_slot text,
  platform text not null,
  content_type text not null,
  recurring boolean default true,
  notes text
);

create table if not exists trend_cache (
  id uuid default gen_random_uuid() primary key,
  fetched_at timestamptz default now(),
  source text not null,
  data_type text not null,
  data jsonb not null,
  expires_at timestamptz not null
);

create index if not exists trend_cache_lookup on trend_cache(source, data_type, expires_at desc);

create table if not exists social_connections (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade unique,
  twitter_handle text,
  reddit_username text,
  reddit_default_sub text default 'CompetitiveTFT',
  medium_handle text,
  instagram_handle text,
  updated_at timestamptz default now()
);

alter table content_posts enable row level security;
alter table content_templates enable row level security;
alter table content_calendar enable row level security;
alter table trend_cache enable row level security;
alter table social_connections enable row level security;

-- Owner-only policies
create policy "content_posts_owner" on content_posts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "content_templates_owner" on content_templates for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "content_calendar_owner" on content_calendar for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "social_connections_owner" on social_connections for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- trend_cache is shared read for any authenticated user; writes via service role only
create policy "trend_cache_read" on trend_cache for select
  using (auth.role() = 'authenticated');
