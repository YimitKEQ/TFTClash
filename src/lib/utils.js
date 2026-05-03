import { RCOLS, TIERS } from './constants.js';

// ─── INPUT SANITIZATION ──────────────────────────────────────────────────────
export function sanitize(str) { if (typeof str !== 'string') return ''; return str.replace(/<[^>]*>/g, ''); }

export function rc(r) { return RCOLS[r] || "#A8B2CC"; }

export function tier(pts) { return TIERS.find(function(t) { return pts >= t.min; }) || TIERS[TIERS.length - 1]; }

// Avg placement colour coding
export function avgCol(avg) {
  var n = parseFloat(avg) || 0;
  if (n === 0) return "#BECBD9";
  if (n < 3.0) return "#4ade80"; // green
  if (n <= 5.0) return "#facc15"; // yellow
  return "#f87171"; // red
}

export function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

export function shareToTwitter(text) {
  var encoded = encodeURIComponent(text);
  window.open("https://twitter.com/intent/tweet?text=" + encoded, "_blank", "width=550,height=420");
}

function withRef(path, ref) {
  var base = "https://www.tftclash.com" + (path || "");
  if (!ref) return base;
  var sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "ref=" + encodeURIComponent(String(ref).toLowerCase());
}

export function buildShareText(type, data) {
  data = data || {};
  var ref = data.ref || data.referrer || null;
  if (type === "result") {
    var place = ordinal(data.placement);
    var line = data.placement === 1
      ? "Just took the dub - 1st place in " + data.clashName + " (+" + data.points + " season pts)"
      : "Locked " + place + " in " + data.clashName + " (+" + data.points + " season pts)";
    return line + ".\n\nFree weekly TFT tournaments, all ranks welcome.\n#TFTClash #TFT\n" + withRef("/", ref);
  }
  if (type === "profile") {
    var who = data.name || "Player";
    return who + " - Season #" + data.rank + ", " + data.pts + " pts on TFT Clash. Run it back?\n#TFTClash\n" + withRef("/player/" + encodeURIComponent(who), ref);
  }
  if (type === "recap") {
    return data.winner + " just won " + data.clashName + ". Full bracket, replays, every lobby - all on TFT Clash.\n#TFTClash #TFT\n" + withRef("/", ref);
  }
  if (type === "season") {
    return "Season " + data.seasonName + " wrap on TFT Clash: #" + data.position + " overall, " + data.pts + " pts, " + data.wins + " wins, " + data.avg + " AVP. Bring it next season.\n#TFTClash #TFT\n" + withRef("/", ref);
  }
  if (type === "round") {
    var rPlace = ordinal(data.placement);
    var rLine = data.placement === 1
      ? "1st in Round " + data.round + " of " + data.clashName + ". Game on."
      : rPlace + " in Round " + data.round + " of " + data.clashName + ". One more.";
    return rLine + "\n#TFTClash #TFT\n" + withRef("/", ref);
  }
  return "Free weekly TFT tournaments. Real bracket, real prizes, all ranks welcome.\n#TFTClash\n" + withRef("/", ref);
}

export function isValidRiotId(id) {
  // Format: Name#TAG where Name is 3-16 chars, TAG is 3-5 alphanumeric chars
  return /^.{3,16}#[A-Za-z0-9]{3,5}$/.test((id || '').trim());
}

// ─── SHARED OPS HELPERS ─────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return '-';
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

export function addAudit(supabase, currentUser, type, msg) {
  if (supabase.from && currentUser) {
    supabase.from('audit_log').insert({
      action: type, actor_id: currentUser.id || null,
      actor_name: currentUser.username || currentUser.email || 'Admin',
      target_type: 'admin_action', details: { message: msg, timestamp: Date.now() }
    }).then(function() {}).catch(function() {});
  }
}
