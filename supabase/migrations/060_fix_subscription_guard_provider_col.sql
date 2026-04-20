-- 060_fix_subscription_guard_provider_col.sql
-- The guard trigger installed in 057 referenced paypal_subscription_id, but the
-- column was renamed to provider_subscription_id (with provider_customer_id and
-- a provider text column) as part of the PayPal abstraction. Every authenticated
-- UPDATE on user_subscriptions — including cancel_at_period_end toggles from the
-- client — therefore raises "record 'new' has no field 'paypal_subscription_id'"
-- and the cancel flow silently dies.
--
-- This migration rewrites the guard to use the current column names and to
-- explicitly allow cancel_at_period_end (owner-controlled) while keeping
-- provider/status/tier/billing period locked to the service role.

create or replace function public.user_subscriptions_guard_sensitive_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'authenticated' then
    return new;
  end if;

  if new.tier is distinct from old.tier then
    raise exception 'tier changes must go through server (PayPal webhook)';
  end if;
  if new.status is distinct from old.status then
    raise exception 'status changes must go through server (PayPal webhook)';
  end if;
  if new.provider is distinct from old.provider then
    raise exception 'provider is immutable from client';
  end if;
  if new.provider_subscription_id is distinct from old.provider_subscription_id then
    raise exception 'provider_subscription_id is immutable from client';
  end if;
  if new.provider_customer_id is distinct from old.provider_customer_id then
    raise exception 'provider_customer_id is immutable from client';
  end if;
  if new.current_period_start is distinct from old.current_period_start
     or new.current_period_end is distinct from old.current_period_end then
    raise exception 'billing period is server-managed';
  end if;

  return new;
end;
$$;
