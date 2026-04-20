-- Tighten audit_log INSERT: admin still required, but actor_id MUST match the caller's auth.uid()
-- Prevents an admin from impersonating another admin in the audit trail.
-- Service role keeps unrestricted access for webhooks.

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can insert audit_log" ON public.audit_log;

CREATE POLICY "Admins insert audit_log with own identity" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );
