// Shared helper for resolving the authenticated user's linked player row.
// currentUser.id can be EITHER the player.id integer (from get_my_player RPC)
// OR the auth UUID (from the mapUser fallback when the RPC fails). This helper
// tries every known mapping so screens never crash on the mismatch.

export function resolveLinkedPlayer(currentUser, players) {
  if (!currentUser || !players || !players.length) return null;
  var list = players;
  var cuAuth = currentUser.auth_user_id || currentUser.authUserId;
  var cuId = currentUser.id;
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p) continue;
    if (cuId) {
      if (String(p.id) === String(cuId)) return p;
      if (p.auth_user_id && p.auth_user_id === cuId) return p;
      if (p.authUserId && p.authUserId === cuId) return p;
    }
    if (cuAuth) {
      if (p.auth_user_id && p.auth_user_id === cuAuth) return p;
      if (p.authUserId && p.authUserId === cuAuth) return p;
    }
  }
  var un = (currentUser.username || currentUser.name || '').toLowerCase();
  if (!un) return null;
  for (var j = 0; j < list.length; j++) {
    var q = list[j];
    if (!q) continue;
    if ((q.name || '').toLowerCase() === un) return q;
    if ((q.username || '').toLowerCase() === un) return q;
  }
  return null;
}
