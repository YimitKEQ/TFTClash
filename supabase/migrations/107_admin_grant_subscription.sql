-- Migration 107: admin-side comp passes
-- Lets admins grant/revoke pro/host subscriptions for any user from the
-- /admin Players tab without going through PayPal. Subscription rows are
-- normally service-role-only writable; these RPCs are SECURITY DEFINER and
-- gated on public.is_admin_or_mod(auth.uid()).

-- ─── grant ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
  p_user_id uuid,
  p_plan text,
  p_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_or_mod(v_actor) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('pro','host','free') THEN
    RAISE EXCEPTION 'plan must be pro, host, or free';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end, plan_started_at, updated_at, cancel_at_period_end)
  VALUES (p_user_id, p_plan, 'active', p_until, NOW(), NOW(), false)
  ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        status = 'active',
        current_period_end = EXCLUDED.current_period_end,
        plan_started_at = COALESCE(public.subscriptions.plan_started_at, NOW()),
        updated_at = NOW(),
        cancel_at_period_end = false;

  INSERT INTO public.audit_log (action, actor_id, actor_name, target_type, target_id, details)
  VALUES (
    'ADMIN_GRANT_SUB',
    v_actor,
    'Admin',
    'subscription',
    p_user_id::text,
    jsonb_build_object('plan', p_plan, 'until', p_until)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'plan', p_plan, 'until', p_until);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_subscription(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, text, timestamptz) TO authenticated;

-- ─── revoke ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_revoke_subscription(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_or_mod(v_actor) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.subscriptions
     SET plan = 'free',
         status = 'cancelled',
         current_period_end = NOW(),
         cancel_at_period_end = true,
         updated_at = NOW()
   WHERE user_id = p_user_id;

  INSERT INTO public.audit_log (action, actor_id, actor_name, target_type, target_id, details)
  VALUES (
    'ADMIN_REVOKE_SUB',
    v_actor,
    'Admin',
    'subscription',
    p_user_id::text,
    jsonb_build_object('revoked_at', NOW())
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_subscription(uuid) TO authenticated;

-- ─── admin read-all policy ───────────────────────────────────────────────────
-- Admins need to see comped accounts in the UI.
DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin_or_mod(auth.uid()));
