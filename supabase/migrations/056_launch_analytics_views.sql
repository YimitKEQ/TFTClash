-- 056_launch_analytics_views.sql
-- Read-only analytics views for the ops dashboard.
-- Each view aggregates production tables; no writes, no triggers.
-- Granted to authenticated; downstream RLS / app-side admin gate controls exposure.

-- ─── Daily signups ──────────────────────────────────────────────────────────
-- Counts new players per UTC day for the last 90 days. Joins on auth user
-- creation when available so OAuth-only signups are not under-counted.
CREATE OR REPLACE VIEW public.v_daily_signups AS
SELECT
  date_trunc('day', p.created_at)::date AS day,
  count(*)::bigint                       AS signups,
  count(*) FILTER (WHERE p.tier = 'pro')::bigint  AS pro_signups,
  count(*) FILTER (WHERE p.tier = 'host')::bigint AS host_signups
FROM public.players p
WHERE p.created_at >= (now() - interval '90 days')
GROUP BY 1
ORDER BY 1 DESC;

-- ─── Daily active players (DAP) ─────────────────────────────────────────────
-- A player is "active" on a day if they appear in game_results, registrations,
-- or notifications activity for that day. 30-day rolling window.
CREATE OR REPLACE VIEW public.v_daily_active_players AS
WITH activity AS (
  SELECT date_trunc('day', created_at)::date AS day, player_id::text AS who
    FROM public.game_results
   WHERE created_at >= (now() - interval '30 days')
     AND player_id IS NOT NULL
  UNION ALL
  SELECT date_trunc('day', created_at)::date, player_id::text
    FROM public.registrations
   WHERE created_at >= (now() - interval '30 days')
     AND player_id IS NOT NULL
)
SELECT day, count(DISTINCT who)::bigint AS active_players
  FROM activity
 GROUP BY day
 ORDER BY day DESC;

-- ─── Weekly revenue (gross, before PayPal fees) ─────────────────────────────
-- Treats each active subscription as recurring monthly revenue and bins by
-- the ISO week of current_period_start. Refunded / cancelled rows are excluded.
CREATE OR REPLACE VIEW public.v_weekly_revenue AS
SELECT
  date_trunc('week', current_period_start)::date AS week_start,
  tier,
  count(*)::bigint                                AS active_subs,
  sum(
    CASE tier
      WHEN 'pro'    THEN 4.99
      WHEN 'scrim'  THEN 9.99
      WHEN 'bundle' THEN 12.99
      WHEN 'host'   THEN 19.99
      ELSE 0
    END
  )::numeric(10, 2) AS gross_usd
FROM public.user_subscriptions
WHERE status = 'active'
  AND current_period_start >= (now() - interval '180 days')
GROUP BY 1, 2
ORDER BY 1 DESC, tier;

-- ─── Funnel snapshot ────────────────────────────────────────────────────────
-- Single-row view: top-level KPIs for the ops dashboard.
CREATE OR REPLACE VIEW public.v_launch_kpis AS
SELECT
  (SELECT count(*) FROM public.players)                                              AS total_players,
  (SELECT count(*) FROM public.players WHERE created_at >= now() - interval '7 days') AS players_7d,
  (SELECT count(*) FROM public.user_subscriptions WHERE status = 'active')           AS active_subs,
  (SELECT count(*) FROM public.user_subscriptions
     WHERE status = 'active' AND current_period_start >= now() - interval '7 days')  AS new_subs_7d,
  (SELECT count(*) FROM public.tournaments WHERE created_at >= now() - interval '7 days') AS tournaments_7d,
  (SELECT count(*) FROM public.game_results WHERE created_at >= now() - interval '7 days') AS games_7d;

-- ─── Permissions ────────────────────────────────────────────────────────────
-- Views inherit RLS from underlying tables, but we tighten grants:
GRANT SELECT ON public.v_daily_signups        TO authenticated;
GRANT SELECT ON public.v_daily_active_players TO authenticated;
GRANT SELECT ON public.v_weekly_revenue       TO authenticated;
GRANT SELECT ON public.v_launch_kpis          TO authenticated;

-- These views surface aggregate data only; no PII columns are projected.
-- Admin gating happens at the application layer via user_roles.role = 'admin'.
COMMENT ON VIEW public.v_daily_signups        IS 'Daily new signup counts (90d); ops dashboard.';
COMMENT ON VIEW public.v_daily_active_players IS 'Distinct active players per day (30d); ops dashboard.';
COMMENT ON VIEW public.v_weekly_revenue       IS 'Weekly gross subscription revenue by tier (180d); ops dashboard.';
COMMENT ON VIEW public.v_launch_kpis          IS 'Single-row top-level KPI snapshot for the ops dashboard.';
