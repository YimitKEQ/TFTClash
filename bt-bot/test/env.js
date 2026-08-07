/**
 * env.js - test environment shim.
 *
 * lib/supabase.js throws at import time when its credentials are missing, which
 * is correct in production and inconvenient in a unit test. Every test file
 * imports this FIRST: ES modules evaluate their dependencies in source order,
 * so these values are in place before anything reaches the real client.
 *
 * The values are deliberately fake. A test that somehow reaches the network
 * should fail loudly rather than quietly read the live board.
 */

if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'http://localhost:54321';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Keep the crew mapping empty so mention() renders plain names and assertions
// do not depend on whatever ids happen to be in a local .env.
process.env.BT_CREW_DISCORD = '';
