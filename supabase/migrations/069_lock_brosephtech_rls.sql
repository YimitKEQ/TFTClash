-- 069_lock_brosephtech_rls.sql
-- Brosephtech internal tooling tables were created with permissive RLS during
-- prototyping (USING (true) WITH CHECK (true)) or with RLS disabled entirely.
-- Since the public schema is exposed via PostgREST and the anon key ships in
-- the client bundle, anonymous browsers can currently read/write all internal
-- kanban, idea, hook, metric, and tier-list data.
--
-- Lock down: enable RLS on missing tables, replace open policies with
-- admin/mod-only access. Brosephtech is an internal tool; only authenticated
-- admin/mod users need access. Service role retains full access for backend RPCs.
--
-- Also fixes function_search_path_mutable on the two bt_* helpers and
-- public.touch_updated_at flagged by Supabase advisors.

begin;

-- ── 1. Enable RLS on tables missing it ──────────────────────────────────────
alter table if exists public.bt_card_comments  enable row level security;
alter table if exists public.bt_card_templates enable row level security;

-- ── 2. Replace open policies on bt_* tables with admin/mod gating ──────────
do $$
declare
  t text;
  policy_name text;
  policies text[][] := array[
    array['bt_content_cards',     'bt_cards_open'],
    array['bt_hooks',             'bt_hooks_all'],
    array['bt_ideas',             'bt_ideas_all'],
    array['bt_metrics_snapshots', 'bt_metrics_open'],
    array['bt_tier_lists',        'bt_tier_lists_all']
  ];
  i int;
begin
  for i in 1 .. array_length(policies, 1) loop
    t := policies[i][1];
    policy_name := policies[i][2];
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', policy_name, t);
      execute format(
        'create policy "Admins manage %I" on public.%I for all to authenticated '
        'using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array[''admin'',''mod'']))) '
        'with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array[''admin'',''mod''])))',
        t, t
      );
    end if;
  end loop;
end $$;

-- ── 3. Lock down bt_card_comments and bt_card_templates ────────────────────
do $$
begin
  if to_regclass('public.bt_card_comments') is not null then
    drop policy if exists "Admins manage bt_card_comments" on public.bt_card_comments;
    create policy "Admins manage bt_card_comments" on public.bt_card_comments for all to authenticated
      using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
      with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
  end if;

  if to_regclass('public.bt_card_templates') is not null then
    drop policy if exists "Admins manage bt_card_templates" on public.bt_card_templates;
    create policy "Admins manage bt_card_templates" on public.bt_card_templates for all to authenticated
      using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
      with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
  end if;
end $$;

-- ── 4. Fix function search_path mutability (privilege-escalation hardening) ─
-- touch_updated_at runs in many SECURITY DEFINER triggers; pinning search_path
-- to public prevents schema-shadowing attacks via the user's role search_path.
do $$
begin
  if exists (select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'touch_updated_at') then
    alter function public.touch_updated_at() set search_path = public;
  end if;
  if exists (select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'bt_touch_column_changed_at') then
    alter function public.bt_touch_column_changed_at() set search_path = public;
  end if;
end $$;

-- ── 5. Tighten newsletter_subscribers INSERT (validate email format only) ──
-- Public newsletter signup is intentional, but require an email-shaped value
-- so the table can't be used as free general-purpose storage.
do $$
begin
  if to_regclass('public.newsletter_subscribers') is not null then
    drop policy if exists "anyone_can_subscribe" on public.newsletter_subscribers;
    create policy "anyone_can_subscribe" on public.newsletter_subscribers for insert
      with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end $$;

commit;
