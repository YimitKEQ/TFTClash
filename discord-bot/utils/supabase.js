import { createClient } from '@supabase/supabase-js';

// Uses service_role key — bot has full write access. NEVER expose this in the frontend.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
