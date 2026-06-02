-- 113_lock_user_subscriptions_client_writes.sql
-- SECURITY FIX (audit 2026-06-02): mig 064 created permissive client policies
-- "Users insert own subscription" (INSERT) and "Users update own subscription"
-- (UPDATE) on public.user_subscriptions. The sensitive-column guard trigger only
-- fires BEFORE UPDATE, never on INSERT, so any authenticated user could run
--   supabase.from('user_subscriptions').insert({user_id: myUid, tier:'host', status:'active'})
-- and self-grant all Pro/Host features for free (getUserTier reads tier where
-- status='active').
--
-- The app never writes this table from the client: tier/status are set ONLY by the
-- PayPal webhook (api/paypal-webhook.js, runs as service_role and bypasses RLS) and
-- cancellation goes through the cancel-subscription serverless function. So we drop
-- both client write policies. SELECT ("users read own subscription") and the
-- service_role ALL policy remain, so reading tier and webhook writes still work.

drop policy if exists "Users insert own subscription" on public.user_subscriptions;
drop policy if exists "Users update own subscription" on public.user_subscriptions;

-- Belt-and-braces: ensure RLS is on (it already is) so no write path is implicitly open.
alter table public.user_subscriptions enable row level security;
