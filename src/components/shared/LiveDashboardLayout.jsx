import Icon from '../ui/Icon.jsx'
import { ordinal } from '../../lib/utils.js'

function KpiTile(props) {
  var accent = !!props.accent
  return (
    <div className={'rounded-lg border p-4 ' + (accent ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-low border-outline-variant/15')}>
      <div className="flex items-center gap-2 mb-2">
        <Icon name={props.icon} size={14} className={accent ? 'text-primary' : 'text-on-surface-variant/50'} />
        <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/60">{props.label}</span>
      </div>
      <div className={'font-display text-2xl tabular-nums ' + (accent ? 'text-primary' : 'text-on-surface')}>{props.value}</div>
      {props.sub && <div className="font-mono text-[11px] text-on-surface-variant/40 mt-1">{props.sub}</div>}
    </div>
  )
}

function TimelinePill(props) {
  var status = props.status
  var cls = status === 'done'
    ? 'bg-success/10 text-success border-success/20'
    : status === 'live'
      ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
      : 'bg-surface-container-high text-on-surface-variant/40 border-outline-variant/10'
  var iconName = status === 'done' ? 'check_circle' : status === 'live' ? 'bolt' : 'radio_button_unchecked'
  return (
    <div className={'flex items-center gap-2 px-4 py-2 rounded font-label text-xs tracking-widest uppercase border flex-shrink-0 ' + cls}>
      <Icon name={iconName} size={14} />
      <span className="font-bold">{props.label}</span>
      {props.sub && <span className="opacity-70 font-mono normal-case tracking-normal">{props.sub}</span>}
    </div>
  )
}

function Pill(props) {
  var tone = props.tone || 'neutral'
  var cls = tone === 'live'
    ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
    : tone === 'muted'
      ? 'bg-surface-container-high/60 text-on-surface-variant border-outline-variant/20'
      : 'bg-surface-container-high text-on-surface border-outline-variant/30'
  return (
    <span className={'px-3 py-1 rounded font-label text-xs tracking-wider border flex items-center gap-1.5 ' + cls}>
      {tone === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />}
      {props.label}
    </span>
  )
}

function LiveDashboardLayout(props) {
  var kicker = props.kicker
  var titleParts = props.titleParts || { left: 'TFT Clash', right: '' }
  var pills = props.pills || []
  var cta = props.cta
  var secondaryMeta = props.secondaryMeta
  var kpis = props.kpis || []
  var myStatus = props.myStatus
  var standings = props.standings || []
  var cutLine = props.cutLine || 0
  var cutAfterRound = props.cutAfterRound || 0
  var currentRound = props.currentRound || 1
  var ticker = props.ticker || []
  var timeline = props.timeline || { round: 1, totalRounds: 1, lockedThisRound: 0, lobbiesThisRound: 0 }
  var fullStandingsLink = props.fullStandingsLink
  var footer = props.footer

  return (
    <div className="max-w-7xl mx-auto">

      {/* HERO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="min-w-0">
          {kicker && (
            <div className="font-label text-[11px] font-bold text-secondary tracking-[.18em] uppercase mb-1.5">
              {kicker}
            </div>
          )}
          <h1 className="font-display text-4xl md:text-5xl text-on-background mb-3 uppercase tracking-tight break-words">
            <span className="text-on-surface-variant/80">{titleParts.left}</span>
            {titleParts.right && (
              <>
                <span className="text-on-surface-variant/40 mx-2">/</span>
                <span className="text-primary">{titleParts.right}</span>
              </>
            )}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {pills.map(function (p, i) { return <Pill key={i} label={p.label} tone={p.tone} /> })}
            {secondaryMeta && (
              <span className="font-mono text-sm text-on-surface-variant/70">{secondaryMeta}</span>
            )}
          </div>
        </div>
        {cta && (
          <button
            onClick={cta.onClick}
            className="px-5 py-3 bg-primary text-on-primary rounded-lg font-label font-bold text-xs tracking-widest uppercase shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center gap-2 self-start md:self-end">
            {cta.icon && <Icon name={cta.icon} size={16} />}
            {cta.label}
            <Icon name="arrow_forward" size={16} />
          </button>
        )}
      </div>

      {/* KPI strip */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {kpis.map(function (k, i) {
            return <KpiTile key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />
          })}
        </div>
      )}

      {/* Your status */}
      {myStatus && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <Icon name="person_pin" size={28} className="text-primary" />
          <div className="flex-1">
            <div className="font-label text-xs tracking-widest uppercase text-primary/80">Your Status</div>
            <div className="font-display text-xl text-on-surface mt-1">
              {myStatus.lobbyNumber ? ('Lobby ' + myStatus.lobbyNumber + ' · ') : ''}
              {ordinal(myStatus.position)} overall · {myStatus.points} pts
            </div>
            {typeof myStatus.games === 'number' && (
              <div className="font-mono text-xs text-on-surface-variant/50 mt-1">{myStatus.games + ' games played'}</div>
            )}
          </div>
          {myStatus.onJump && (
            <button
              onClick={myStatus.onJump}
              className="px-4 py-2 bg-surface-container-high text-on-surface rounded font-label text-xs tracking-widest uppercase font-bold hover:bg-surface-container-highest transition-colors flex items-center gap-2">
              {myStatus.jumpLabel || 'Jump to my lobby'}
              <Icon name="arrow_forward" size={14} />
            </button>
          )}
        </div>
      )}

      {/* Top 10 + Activity ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        <div className="lg:col-span-2 bg-surface-container-low border border-outline-variant/15 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
            <Icon name="leaderboard" size={18} className="text-primary" />
            <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Live Top 10</span>
            <span className="ml-auto font-mono text-xs text-on-surface-variant/50">{'after R' + Math.max(currentRound - 1, 0)}</span>
          </div>
          <div className="divide-y divide-outline-variant/5">
            {standings.slice(0, 10).map(function (row, i) {
              var isLeader = i === 0 && (row.points || 0) > 0
              var belowCut = cutLine > 0 && currentRound >= cutAfterRound && (row.points || 0) <= cutLine
              return (
                <div
                  key={row.id || row.name || i}
                  className={'flex items-center gap-4 px-5 py-3 ' + (isLeader ? 'bg-primary/5' : '') + (belowCut ? ' opacity-50' : '')}
                >
                  <span className={'font-display text-2xl w-10 tabular-nums ' + (isLeader ? 'text-primary' : 'text-on-surface-variant/60')}>{i + 1}</span>
                  <span className="flex-1 font-body text-on-surface truncate">{row.name}</span>
                  {typeof row.games === 'number' && (
                    <span className="font-mono text-xs text-on-surface-variant/50 hidden sm:inline">{row.games + ' games'}</span>
                  )}
                  <span className="font-display text-xl text-on-surface tabular-nums">{row.points || 0}</span>
                  <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/40">pts</span>
                </div>
              )
            })}
            {standings.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-on-surface-variant/40">No standings yet.</div>
            )}
          </div>
          {fullStandingsLink && (
            <div className="px-5 py-3 border-t border-outline-variant/10">
              <button
                onClick={fullStandingsLink.onClick}
                className="font-label text-xs tracking-widest uppercase text-primary hover:brightness-125 flex items-center gap-1.5">
                {fullStandingsLink.label}
                <Icon name="arrow_forward" size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
            <Icon name="bolt" size={18} className="text-tertiary" />
            <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Activity</span>
          </div>
          <div className="divide-y divide-outline-variant/5 max-h-[460px] overflow-y-auto">
            {ticker.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-on-surface-variant/40">Waiting for first results…</div>
            )}
            {ticker.map(function (e, i) {
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Icon name={e.icon} size={14} className={e.tone === 'win' ? 'text-primary' : 'text-on-surface-variant/50'} />
                  <span className="font-body text-sm text-on-surface-variant flex-1">{e.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Round timeline */}
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Icon name="timeline" size={18} className="text-primary" />
          <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Round Timeline</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {Array.from({ length: timeline.totalRounds || 1 }).map(function (_, i) {
            var rNum = i + 1
            var status = rNum < timeline.round ? 'done' : rNum === timeline.round ? 'live' : 'pending'
            var sub = status === 'live'
              ? ((timeline.lockedThisRound || 0) + '/' + (timeline.lobbiesThisRound || 0))
              : status === 'done' ? 'done' : ''
            return (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <TimelinePill status={status} label={'R' + rNum} sub={sub} />
                {i < (timeline.totalRounds || 1) - 1 && <div className="w-6 h-px bg-outline-variant/20" />}
              </div>
            )
          })}
        </div>
      </div>

      {footer}

    </div>
  )
}

export default LiveDashboardLayout
