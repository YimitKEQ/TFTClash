/**
 * supabase.js - service-role Supabase client.
 *
 * The BrosephTech bot only READS the shared content board (bt_content_cards).
 * It uses the service role key so it can read regardless of row-level security.
 * Keep this key server-side only and never expose it in any client bundle.
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

export var supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
