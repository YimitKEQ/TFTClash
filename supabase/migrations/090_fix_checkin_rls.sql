-- 090_fix_checkin_rls.sql
-- The "Users update own registration" policy's WITH CHECK only allowed
-- statuses ('registered', 'dropped', 'waitlist'), which:
--   1. blocks self check-in (status = 'checked_in') with a RLS error
--   2. uses the wrong literal 'waitlist' (the app writes 'waitlisted')
-- Replace the policy with one that allows the four real statuses a
-- player should be able to set on their own registration.

DROP POLICY IF EXISTS "Users update own registration" ON public.registrations;

CREATE POLICY "Users update own registration"
  ON public.registrations
  FOR UPDATE
  USING (
    player_id = (
      SELECT players.id FROM players
      WHERE players.auth_user_id = (SELECT auth.uid()) LIMIT 1
    )
  )
  WITH CHECK (
    player_id = (
      SELECT players.id FROM players
      WHERE players.auth_user_id = (SELECT auth.uid()) LIMIT 1
    )
    AND status = ANY (ARRAY['registered'::text, 'checked_in'::text, 'dropped'::text, 'waitlisted'::text])
    AND NOT EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = registrations.player_id
        AND COALESCE(p.banned, false) = true
    )
  );
