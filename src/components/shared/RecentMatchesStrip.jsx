import { Icon } from '../ui'
import { ordinal } from '../../lib/utils.js'

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
  return 0
}

function formatRelative(ms) {
  if (!ms) return ''
  var diff = Date.now() - ms
  if (diff < 0 || diff > 1000 * 60 * 60 * 24 * 365 * 5) return ''
  var sec = Math.floor(diff / 1000)
  if (sec < 60) return 'now'
  var min = Math.floor(sec / 60)
  if (min < 60) return min + 'm'
  var hr = Math.floor(min / 60)
  if (hr < 24) return hr + 'h'
  var day = Math.floor(hr / 24)
  if (day < 7) return day + 'd'
  var wk = Math.floor(day / 7)
  if (wk < 4) return wk + 'w'
  var mo = Math.floor(day / 30)
  return mo + 'mo'
}

function placementClasses(place) {
  if (place === 1) return { bg: 'bg-primary/15 border-primary/40', text: 'text-primary', icon: 'emoji_events' }
  if (place === 2) return { bg: 'bg-on-surface/10 border-on-surface/30', text: 'text-on-surface', icon: 'workspace_premium' }
  if (place === 3) return { bg: 'bg-tertiary/10 border-tertiary/30', text: 'text-tertiary', icon: 'workspace_premium' }
  if (place && place <= 4) return { bg: 'bg-secondary/10 border-secondary/30', text: 'text-secondary', icon: 'shield' }
  return { bg: 'bg-surface-container-high border-outline-variant/20', text: 'text-on-surface-variant', icon: 'sports_esports' }
}

export default function RecentMatchesStrip(props) {
  var player = props.player
  var limit = props.limit || 5
  var title = props.title || 'LAST 5 CLASHES'
  var dense = !!props.dense

  if (!player) return null
  var hist = (player.clashHistory || []).slice()
  hist.sort(function (a, b) { return entryTimestamp(b) - entryTimestamp(a) })
  var recent = hist.slice(0, limit)

  if (recent.length === 0) {
    return (
      <div className={'rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur ' + (dense ? 'p-4' : 'p-5')}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="history" className="text-secondary" />
          <h3 className={'font-display tracking-wide ' + (dense ? 'text-sm' : 'text-base')}>{title}</h3>
        </div>
        <div className="text-xs text-on-surface-variant/60">
          No clashes played yet. Register for an upcoming tournament to start your streak.
        </div>
      </div>
    )
  }

  var avgPlace = (recent.reduce(function (sum, g) { return sum + (g.place || g.placement || 0) }, 0) / recent.length).toFixed(2)
  var totalPts = recent.reduce(function (sum, g) { return sum + (g.pts || 0) }, 0)

  return (
    <div className={'rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur ' + (dense ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="history" className="text-secondary" />
          <h3 className={'font-display tracking-wide ' + (dense ? 'text-sm' : 'text-base')}>{title}</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-label tracking-widest uppercase text-on-surface-variant/50">
          <span>AVP <span className="text-on-surface font-bold">{avgPlace}</span></span>
          <span>+<span className="text-tertiary font-bold">{totalPts}</span> pts</span>
        </div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(' + recent.length + ', minmax(0, 1fr))' }}>
        {recent.map(function (g, i) {
          var place = g.place || g.placement
          var name = g.name || ('Clash #' + (hist.length - i))
          var ts = entryTimestamp(g)
          var rel = formatRelative(ts)
          var cls = placementClasses(place)
          return (
            <div
              key={(g.clashId || g.date || 'idx-' + i)}
              className={'rounded-lg border p-2.5 sm:p-3 flex flex-col items-center gap-1 ' + cls.bg}
              title={name + ' - ' + (place ? ordinal(place) : 'No placement')}
            >
              <Icon name={cls.icon} size={dense ? 14 : 16} className={cls.text} />
              <div className={'font-mono font-bold ' + cls.text + ' ' + (dense ? 'text-sm' : 'text-base')}>
                {place ? ordinal(place) : '\u2014'}
              </div>
              <div className="text-[9px] font-mono text-on-surface-variant/40 truncate max-w-full">
                {rel || ''}
              </div>
              <div className={'text-[9px] font-label tracking-wider uppercase ' + cls.text + '/80'}>
                +{g.pts || 0} pts
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
