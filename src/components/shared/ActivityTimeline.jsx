import { Icon } from '../ui'
import { ACHIEVEMENTS } from '../../lib/stats.js'

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return n + 'th'
  var lastDigit = n % 10
  if (lastDigit === 1) return n + 'st'
  if (lastDigit === 2) return n + 'nd'
  if (lastDigit === 3) return n + 'rd'
  return n + 'th'
}

function entryTimestamp(entry) {
  if (!entry) return 0
  if (entry.date) {
    var ms = new Date(entry.date).getTime()
    if (!isNaN(ms)) return ms
  }
  if (entry.completedAt) {
    var ms2 = new Date(entry.completedAt).getTime()
    if (!isNaN(ms2)) return ms2
  }
  if (entry.clashId) {
    var match = String(entry.clashId).match(/(\d+)/)
    if (match) return parseInt(match[1], 10)
  }
  return 0
}

function formatRelative(ms) {
  if (!ms) return ''
  var diff = Date.now() - ms
  if (diff < 0) return ''
  var sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  var min = Math.floor(sec / 60)
  if (min < 60) return min + 'm ago'
  var hr = Math.floor(min / 60)
  if (hr < 24) return hr + 'h ago'
  var day = Math.floor(hr / 24)
  if (day < 7) return day + 'd ago'
  var wk = Math.floor(day / 7)
  if (wk < 4) return wk + 'w ago'
  var mo = Math.floor(day / 30)
  if (mo < 12) return mo + 'mo ago'
  return Math.floor(day / 365) + 'y ago'
}

function buildEvents(player) {
  if (!player) return []
  var events = []
  var hist = player.clashHistory || []

  hist.forEach(function (g, i) {
    var place = g.place || g.placement
    var ts = entryTimestamp(g) || (i + 1)
    var name = g.name || ('Clash #' + (i + 1))
    var pts = g.pts || 0
    var stableKey = g.clashId || g.date || ('idx-' + i)

    if (place === 1) {
      events.push({
        id: 'win-' + stableKey,
        type: 'win',
        ts: ts,
        title: 'Won ' + name,
        body: 'Took 1st place and earned +' + pts + ' pts.',
        icon: 'emoji_events',
        tone: 'tertiary',
      })
    } else if (place && place <= 4) {
      events.push({
        id: 'top4-' + stableKey,
        type: 'top4',
        ts: ts,
        title: ordinal(place) + ' in ' + name,
        body: 'Top 4 finish (+' + pts + ' pts).',
        icon: 'workspace_premium',
        tone: 'primary',
      })
    } else if (place) {
      events.push({
        id: 'game-' + stableKey,
        type: 'game',
        ts: ts,
        title: ordinal(place) + ' in ' + name,
        body: '+' + pts + ' pts earned.',
        icon: 'sports_esports',
        tone: 'neutral',
      })
    }

    if (g.claimedClutch || g.clutch) {
      events.push({
        id: 'clutch-' + stableKey,
        type: 'clutch',
        ts: ts + 1,
        title: 'Clutch moment',
        body: 'Pulled off a clutch finish in ' + name + '.',
        icon: 'bolt',
        tone: 'tertiary',
      })
    }
    if (g.comebackTriggered) {
      events.push({
        id: 'comeback-' + stableKey,
        type: 'comeback',
        ts: ts + 2,
        title: 'Comeback bonus',
        body: 'Returned after missing weeks for +2 bonus pts.',
        icon: 'autorenew',
        tone: 'primary',
      })
    }
    if (g.attendanceMilestone) {
      events.push({
        id: 'streak-' + stableKey,
        type: 'streak',
        ts: ts + 3,
        title: g.attendanceMilestone + '-week attendance',
        body: 'Showed up ' + g.attendanceMilestone + ' weeks in a row.',
        icon: 'event_available',
        tone: 'primary',
      })
    }
  })

  var unlocked = ACHIEVEMENTS.filter(function (a) {
    try { return a.check(player) } catch (e) { return false }
  })
  var lastHistTs = hist.length > 0 ? entryTimestamp(hist[hist.length - 1]) : 0
  var anchorTs = lastHistTs || Date.now()
  unlocked.slice(-3).forEach(function (a, i) {
    events.push({
      id: 'ach-' + a.id,
      type: 'achievement',
      ts: anchorTs + 100 + i,
      title: 'Unlocked: ' + a.name,
      body: a.desc,
      icon: 'military_tech',
      tone: 'tertiary',
    })
  })

  events.sort(function (a, b) { return b.ts - a.ts })
  return events
}

var TONE_CLASS = {
  tertiary: { dot: 'bg-tertiary border-tertiary/40', text: 'text-tertiary' },
  primary:  { dot: 'bg-primary border-primary/40',   text: 'text-primary' },
  neutral:  { dot: 'bg-on-surface-variant/40 border-outline-variant/30', text: 'text-on-surface-variant' },
}

export default function ActivityTimeline(props) {
  var player = props.player
  var limit = props.limit || 8

  if (!player) return null
  var events = buildEvents(player).slice(0, limit)

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-5 text-center">
        <Icon name="timeline" className="text-on-surface-variant/30 text-4xl mb-2" />
        <div className="font-display text-base text-on-surface mb-1">No activity yet</div>
        <div className="text-xs text-on-surface-variant/60">
          Activity shows up here after this player joins their first clash.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="timeline" className="text-primary" />
        <h3 className="font-display text-base tracking-wide">RECENT ACTIVITY</h3>
      </div>
      <ol className="relative border-l border-outline-variant/20 ml-3 space-y-4">
        {events.map(function (e) {
          var tone = TONE_CLASS[e.tone] || TONE_CLASS.neutral
          return (
            <li key={e.id} className="ml-4 relative">
              <span className={'absolute -left-[22px] top-1 w-3 h-3 rounded-full border-2 ' + tone.dot}></span>
              <div className="flex items-start gap-2">
                <Icon name={e.icon} className={tone.text + ' mt-0.5'} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div className={'font-label font-bold text-sm ' + tone.text}>{e.title}</div>
                    <div className="text-[10px] font-label tracking-wider uppercase text-on-surface-variant/40">
                      {formatRelative(e.ts)}
                    </div>
                  </div>
                  <div className="text-xs text-on-surface-variant/70 leading-relaxed mt-0.5">{e.body}</div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
