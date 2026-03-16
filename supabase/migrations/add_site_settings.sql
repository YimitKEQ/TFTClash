-- site_settings: key-value store for all shared real-time state
-- Keys: players, tournament_state, quick_clashes, announcement,
--       season_config, org_sponsors, scheduled_events, audit_log, host_apps
create table if not exists site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table site_settings enable row level security;

-- Anyone can read (needed for realtime subscriptions from all browsers)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='site_settings' and policyname='read all') then
    create policy "read all" on site_settings for select using (true);
  end if;
end $$;

-- Anyone can write (admin gate is enforced in the app, not at DB level)
-- To tighten: replace `true` with `auth.role() = 'authenticated'`
do $$ begin
  if not exists (select 1 from pg_policies where tablename='site_settings' and policyname='write all') then
    create policy "write all" on site_settings for all using (true) with check (true);
  end if;
end $$;
