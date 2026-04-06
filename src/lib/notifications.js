import { supabase } from './supabase.js';

export function writeActivityEvent(type, playerId, text) {
  supabase.from("activity_feed").insert({
    type: type,
    player_id: playerId,
    detail_json: {text: text}
  }).then(function(r) {
    if (r.error) console.warn('Activity feed write failed:', r.error.message);
  }).catch(function(err) { console.warn('Activity feed write error:', err); });
}

// Module-level helper - usable in any component without prop-drilling
export function createNotification(userId, title, body, icon) {
  if (!userId) return Promise.resolve();
  return supabase.from('notifications').insert({
    user_id: userId, title: title, body: body, message: body, icon: icon || "bell", type: "info",
    read: false, created_at: new Date().toISOString()
  });
}
