-- 121_bt_board_shared_access.sql
-- The BrosephTech command center is an internal crew tool shared by link + a
-- client-side PIN, not by individual accounts. Migration 069 had locked the
-- bt_* tables to authenticated admin/mod users, which meant teammates opening
-- the shared link (no admin account) saw an empty board and could not save.
--
-- This deliberately re-opens the bt_* tooling tables to anon + authenticated
-- read/write so the whole crew can collaborate via the shared link. The PIN is
-- the only gate; the anon key is public, so NO secrets should be stored in
-- these tables. This is an intentional, owner-approved trade-off for an
-- internal tool. To tighten later, grant specific accounts a crew role and
-- swap the open policy for a role check.
--
-- Idempotent: safe to re-run. The bot keeps using the service role (bypasses
-- RLS) regardless.

do $$
declare
  t text;
  tbls text[] := array[
    'bt_content_cards',
    'bt_card_comments',
    'bt_card_templates',
    'bt_meetings',
    'bt_hooks',
    'bt_ideas',
    'bt_metrics_snapshots',
    'bt_tier_lists'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "Admins manage %s" on public.%I', t, t);
      execute format('drop policy if exists "bt open %s" on public.%I', t, t);
      execute format(
        'create policy "bt open %s" on public.%I for all to anon, authenticated using (true) with check (true)',
        t, t
      );
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    end if;
  end loop;
end $$;
