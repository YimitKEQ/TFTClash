-- 057_db_code_review_fixes.sql
-- Launch-readiness DB review: 3 P0 fixes + 2 P1 cleanups
--
-- P0s (verified via pg_policies + information_schema):
--   1. user_subscriptions UPDATE WITH CHECK rejects cancel_at_period_end on active subs
--      → client-side cancelSubscription() silently fails. Fix via column guard trigger.
--   2. notifications has no variant column → cron retention idempotency uses title ilike,
--      breaks if copy changes. Add variant + partial unique index.
--
-- P1s:
--   3. site_settings has duplicate SELECT policies (public_read + read_all). Drop read_all.
--   4. audit_log admin SELECT policy reads players.is_admin while other admin-gated tables
--      use user_roles.role='admin'. Consolidate to user_roles for single source of truth.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_subscriptions: allow owner to set cancel_at_period_end on any status
--    (status + tier + paypal_* still locked to service role via trigger)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users can update own subscription limited" on public.user_subscriptions;

create policy "Users can update own subscription"
  on public.user_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.user_subscriptions_guard_sensitive_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role bypasses RLS entirely; trigger runs for everyone, so we gate
  -- on the current JWT role. authenticated = real users; service_role / anon
  -- writes come from server code and are permitted.
  if current_setting('request.jwt.claim.role', true) <> 'authenticated' then
    return new;
  end if;

  if new.tier is distinct from old.tier then
    raise exception 'tier changes must go through server (PayPal webhook)';
  end if;
  if new.status is distinct from old.status then
    raise exception 'status changes must go through server (PayPal webhook)';
  end if;
  if new.paypal_subscription_id is distinct from old.paypal_subscription_id then
    raise exception 'paypal_subscription_id is immutable from client';
  end if;
  if new.current_period_start is distinct from old.current_period_start
     or new.current_period_end is distinct from old.current_period_end then
    raise exception 'billing period is server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_subscriptions_guard on public.user_subscriptions;
create trigger trg_user_subscriptions_guard
  before update on public.user_subscriptions
  for each row
  execute function public.user_subscriptions_guard_sensitive_cols();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notifications.variant for cron idempotency
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notifications
  add column if not exists variant text;

comment on column public.notifications.variant is
  'Optional campaign identifier for idempotency (e.g. retention_d3). Null for ad-hoc notifications.';

create unique index if not exists notifications_variant_unique_per_user
  on public.notifications (user_id, variant)
  where variant is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. site_settings: drop duplicate public SELECT policy
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "read_all" on public.site_settings;
-- keep "public_read" (same qual: true)

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. audit_log: consolidate admin gate to user_roles
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Admins read audit log" on public.audit_log;

create policy "Admins read audit log"
  on public.audit_log
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  );

commit;
