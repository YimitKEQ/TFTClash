-- ============================================================
-- 045_host_system_rewrite.sql
-- Fix host application flow: proper DB tables, not site_settings
-- ============================================================

-- Allow authenticated users to INSERT their own host application
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can submit own application" ON host_applications;
  CREATE POLICY "Users can submit own application" ON host_applications
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
END $$;

-- Allow users to read all approved applications (for public host directory)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can read approved applications" ON host_applications;
  CREATE POLICY "Anyone can read approved applications" ON host_applications
    FOR SELECT
    USING (status = 'approved' OR user_id = auth.uid());
END $$;

-- Enable RLS on host_applications if not already
ALTER TABLE host_applications ENABLE ROW LEVEL SECURITY;

-- Add vision column to host_applications (from the apply form)
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS vision TEXT DEFAULT '';

-- Add discord column
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS discord TEXT DEFAULT '';

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_host_applications_user_id ON host_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_host_applications_status ON host_applications(status);

-- Ensure host_profiles has proper admin management policy
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage host_profiles" ON host_profiles;
  CREATE POLICY "Admins can manage host_profiles" ON host_profiles FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'mod')))
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'mod')));
END $$;
