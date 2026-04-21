// Tournament region helpers. The platform runs parallel EU and NA stacks —
// see migration 066 for the DB contract. These helpers keep the client copy
// and the server trigger message in sync.

export var TOURNAMENT_REGIONS = ['EU', 'NA'];

export var REGION_META = {
  EU: { label: 'EU', full: 'Europe', flag: '\u{1F1EA}\u{1F1FA}', color: '#4E8AE8' },
  NA: { label: 'NA', full: 'North America', flag: '\u{1F1FA}\u{1F1F8}', color: '#E86F4E' },
};

export function normalizeRegion(raw) {
  if (!raw) return null;
  var v = String(raw).toUpperCase().trim();
  if (v === 'EUW' || v === 'EUNE' || v === 'TR' || v === 'EU') return 'EU';
  if (v === 'NA' || v === 'LATAM' || v === 'BR') return 'NA';
  return null;
}

export function regionLabel(region) {
  var r = normalizeRegion(region);
  return r && REGION_META[r] ? REGION_META[r].label : 'Unset';
}

export function regionFullName(region) {
  var r = normalizeRegion(region);
  return r && REGION_META[r] ? REGION_META[r].full : 'Unset';
}

export function canRegisterInRegion(playerRegion, tournamentRegion) {
  var p = normalizeRegion(playerRegion);
  var t = normalizeRegion(tournamentRegion);
  if (!t) return true;
  if (!p) return false;
  return p === t;
}

export function regionMismatchMessage(playerRegion, tournamentRegion) {
  var p = normalizeRegion(playerRegion);
  var t = normalizeRegion(tournamentRegion);
  if (!t) return null;
  if (!p) return 'Set your server region on your account before signing up for a ' + t + ' tournament.';
  if (p !== t) return 'This is a ' + t + ' tournament. Your account is set to ' + p + '. Switch your region on the Account page to sign up.';
  return null;
}
