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

// Server-side audit trail (see migration 009)
// action: short verb like 'tournament.lock_lobby', 'dispute.resolve'
// actor: { id, name } (optional)
// target: { type, id } (optional)
// details: free-form jsonb (optional)
export function writeAuditLog(action, actor, target, details) {
  if (!action) return Promise.resolve();
  var row = {
    action: String(action).slice(0, 120),
    actor_id: actor && actor.id ? actor.id : null,
    actor_name: actor && actor.name ? String(actor.name).slice(0, 80) : null,
    target_type: target && target.type ? String(target.type).slice(0, 40) : null,
    target_id: target && target.id ? String(target.id).slice(0, 80) : null,
    details: details || {}
  };
  return supabase.from('audit_log').insert(row).then(function(r) {
    if (r && r.error) console.warn('Audit log write failed:', r.error.message);
  }).catch(function(err) { console.warn('Audit log write error:', err); });
}
