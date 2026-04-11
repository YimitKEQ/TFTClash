// Vercel serverless function — Delete user account (auth + data)
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in Vercel env vars

import { createClient } from '@supabase/supabase-js';

var ALLOWED_ORIGINS = [
  'https://tftclash.com',
  'https://tft-clash.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  var allowed = ALLOWED_ORIGINS.indexOf(origin) > -1;

  if (req.method === 'OPTIONS') {
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Access-Control-Allow-Origin', origin);

  // Verify the user's JWT to get their auth ID server-side (don't trust client body)
  var authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  var token = authHeader.slice(7);

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  var supabase = createClient(supabaseUrl, serviceKey);

  // Verify the JWT and extract the user
  var userRes = await supabase.auth.getUser(token);
  if (userRes.error || !userRes.data || !userRes.data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  var authUserId = userRes.data.user.id;

  try {
    // Look up the player's integer id from the players table
    var playerRes = await supabase.from('players').select('id').eq('auth_user_id', authUserId).single();
    var playerId = playerRes.data && playerRes.data.id;

    // Delete child rows that use player.id as FK
    if (playerId) {
      await supabase.from('registrations').delete().eq('player_id', playerId).catch(function() {});
      await supabase.from('player_achievements').delete().eq('player_id', playerId).catch(function() {});
    }

    // Delete child rows that use auth UUID as FK
    await supabase.from('notifications').delete().eq('user_id', authUserId).catch(function() {});
    await supabase.from('user_roles').delete().eq('user_id', authUserId).catch(function() {});
    await supabase.from('host_profiles').delete().eq('user_id', authUserId).catch(function() {});
    await supabase.from('host_applications').delete().eq('user_id', authUserId).catch(function() {});

    // Delete the player row (uses auth_user_id column)
    await supabase.from('players').delete().eq('auth_user_id', authUserId).catch(function() {});

    // Delete the auth user
    var deleteRes = await supabase.auth.admin.deleteUser(authUserId);
    if (deleteRes.error) {
      console.error('[delete-account] auth.admin.deleteUser failed:', deleteRes.error.message);
      return res.status(500).json({ error: 'Failed to delete auth user' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[delete-account] error:', err.message);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
}
