-- 058_analytics_views_invoker.sql
-- Flip launch analytics views from SECURITY DEFINER (Postgres 15+ default on
-- create) to SECURITY INVOKER so they honour the caller's RLS. Admin-only
-- access is enforced at the screen level in CommandCenterScreen.

alter view public.v_launch_kpis          set (security_invoker = on);
alter view public.v_daily_signups        set (security_invoker = on);
alter view public.v_daily_active_players set (security_invoker = on);
alter view public.v_weekly_revenue       set (security_invoker = on);
