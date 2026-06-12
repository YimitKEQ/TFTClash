-- Migration 117: repoint admin comp-pass RPCs to user_subscriptions.
--
-- admin_grant_subscription / admin_revoke_subscription previously wrote to the
-- legacy `subscriptions` table, but the app (AppContext getUserTier) and the
-- PayPal webhook both read/write `user_subscriptions`. So admin grants never
-- took effect in-app. Repoint both RPCs at the canonical table. Column mapping:
-- legacy `plan` -> `tier`, and `provider` is set to 'manual' to mark admin grants
-- ('comp' is rejected by the provider CHECK, which allows paypal/manual/stripe).

CREATE OR REPLACE FUNCTION public.admin_grant_subscription(p_user_id uuid, p_plan text, p_until timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.user_subscriptions
    (user_id, tier, provider, status, current_period_start, current_period_end, cancel_at_period_end, updated_at)
  VALUES
    (p_user_id, p_plan, 'manual', 'active', NOW(), p_until, false, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET tier = EXCLUDED.tier,
        provider = 'manual',
        status = 'active',
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = false,
        updated_at = NOW();

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
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_subscription(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_or_mod(v_actor) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.user_subscriptions
     SET tier = 'free',
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
$function$;
