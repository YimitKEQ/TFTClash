-- 120_bt_meetings.sql
-- Meeting context log for the BrosephTech bot. When a meeting is captured via
-- the bot's /meeting command, its summary and raw notes are stored here and the
-- action items become cards on the board (bt_content_cards).
--
-- RLS mirrors the other bt_* tables (migration 069): only admin/mod authenticated
-- users can read/write from the app. The bot writes with the service role, which
-- bypasses RLS, so it is unaffected.

begin;

create table if not exists public.bt_meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled meeting',
  summary       text not null default '',
  raw_notes     text not null default '',
  created_by    text not null default '',
  tasks_created integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.bt_meetings enable row level security;

do $$
begin
  drop policy if exists "Admins manage bt_meetings" on public.bt_meetings;
  create policy "Admins manage bt_meetings" on public.bt_meetings for all to authenticated
    using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
    with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
end $$;

commit;
