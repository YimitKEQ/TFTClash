/**
 * preview-env.js - environment shim for scripts/preview-embeds.js.
 *
 * lib/supabase.js throws at import time without credentials. ES modules
 * evaluate dependencies in source order, so importing this module FIRST puts
 * these values in place before anything reaches the real client. Assigning to
 * process.env in the body of preview-embeds.js would run too late: static
 * imports are hoisted above it.
 *
 * The credentials are fake on purpose. The preview draws pictures from fixture
 * data and must never touch the live board.
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'preview';

// Two mapped crew members so the preview shows both a real mention pill and the
// plain-name fallback, which is what an unmapped person actually renders as.
process.env.BT_CREW_DISCORD = JSON.stringify({
  Levitate: '100000000000000001',
  Fridley: '100000000000000002',
});
