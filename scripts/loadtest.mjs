// loadtest.mjs - tournament-day load rehearsal for TFT Clash.
//
// Simulates N concurrent users doing what real players do on clash day:
// open a realtime socket, poll players/standings, register, check in,
// and refresh repeatedly. Watch the Supabase dashboard (DB connections,
// CPU, realtime messages) while this runs.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/loadtest.mjs 150
//
// Optional (exercise authenticated writes - requires seeded test users
// lt0@test.tftclash.gg ... ltN@test.tftclash.gg sharing LT_PASS, each with
// a players row, and LT_TID set to a throwaway tournament id):
//   LT_PASS=... LT_TID=<uuid> node scripts/loadtest.mjs 150
//
// Without LT_PASS it runs anonymous read+realtime load only, which is
// still the majority of real Saturday traffic and completely safe.

import { createClient } from '@supabase/supabase-js'

var N = parseInt(process.argv[2] || '100', 10)
var URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
var KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
var PASS = process.env.LT_PASS || ''
var TID = process.env.LT_TID || ''
var DURATION_MS = parseInt(process.env.LT_DURATION_MS || '300000', 10) // 5 min

if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_ equivalents).')
  process.exit(1)
}

var stats = { reads: 0, readErrors: 0, writes: 0, writeErrors: 0, rtConnected: 0, rtErrors: 0 }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }
function jitter(base, spread) { return base + Math.floor(Math.random() * spread) }

async function virtualUser(i) {
  var sb = createClient(URL, KEY, { auth: { persistSession: false } })
  var playerId = null

  if (PASS) {
    var auth = await sb.auth.signInWithPassword({ email: 'lt' + i + '@test.tftclash.gg', password: PASS })
    if (auth.error) { stats.writeErrors++ } else {
      var me = await sb.rpc('get_my_player').maybeSingle()
      if (me.data) playerId = me.data.id
    }
  }

  // Realtime: same channels the real app opens.
  var ch = sb.channel('shared_state_lt' + i)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, function () {})
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, function () {})
    .subscribe(function (status) {
      if (status === 'SUBSCRIBED') stats.rtConnected++
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') stats.rtErrors++
    })

  var deadline = Date.now() + DURATION_MS
  var step = 0
  while (Date.now() < deadline) {
    // The big read every client does (players + settings), like a page load.
    var r1 = await sb.from('players').select('id,username,rank,season_pts,wins,top4,games').limit(250)
    r1.error ? stats.readErrors++ : stats.reads++
    var r2 = await sb.from('site_settings').select('key,value').in('key', ['tournament_state', 'announcement'])
    r2.error ? stats.readErrors++ : stats.reads++

    if (PASS && TID && playerId) {
      if (step === 1) {
        var w1 = await sb.from('registrations').upsert(
          { tournament_id: TID, player_id: playerId, status: 'registered' },
          { onConflict: 'tournament_id,player_id' })
        w1.error ? stats.writeErrors++ : stats.writes++
      }
      if (step === 4) {
        var w2 = await sb.from('registrations')
          .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
          .eq('tournament_id', TID).eq('player_id', playerId)
        w2.error ? stats.writeErrors++ : stats.writes++
      }
    }

    step++
    await sleep(jitter(8000, 8000)) // 8-16s between "refreshes"
  }

  await sb.removeChannel(ch)
  if (PASS) await sb.auth.signOut()
}

console.log('Starting ' + N + ' virtual users for ' + Math.round(DURATION_MS / 1000) + 's against ' + URL)
console.log(PASS ? 'Mode: authenticated read+write' : 'Mode: anonymous read + realtime only')

var t0 = Date.now()
var ticker = setInterval(function () {
  console.log(
    '[' + Math.round((Date.now() - t0) / 1000) + 's] reads=' + stats.reads +
    ' readErr=' + stats.readErrors + ' writes=' + stats.writes +
    ' writeErr=' + stats.writeErrors + ' rtOk=' + stats.rtConnected + ' rtErr=' + stats.rtErrors)
}, 10000)

// Ramp users in over ~20s like a real login wave, not an instant wall.
var users = []
for (var i = 0; i < N; i++) {
  users.push((async function (idx) {
    await sleep(Math.floor(Math.random() * 20000))
    try { await virtualUser(idx) } catch (e) { stats.rtErrors++ }
  })(i))
}
await Promise.allSettled(users)
clearInterval(ticker)

console.log('--- DONE ---')
console.log(JSON.stringify(stats, null, 2))
var failRate = stats.readErrors / Math.max(1, stats.reads + stats.readErrors)
console.log('Read failure rate: ' + (failRate * 100).toFixed(2) + '%')
if (failRate > 0.01 || stats.rtErrors > N * 0.05) {
  console.log('VERDICT: NOT READY - investigate connections/realtime before Saturday.')
  process.exit(2)
}
console.log('VERDICT: PASS at ' + N + ' concurrent users.')
