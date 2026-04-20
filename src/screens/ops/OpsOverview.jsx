import { Icon, Panel, Btn } from '../../components/ui'

function KpiCard(props) {
  var icon = props.icon
  var label = props.label
  var value = props.value
  var sub = props.sub
  var accent = props.accent || 'text-on-surface'
  var pulse = props.pulse
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4 flex flex-col gap-1 relative overflow-hidden group hover:border-primary/20 transition-colors">
      {pulse && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error animate-pulse" />}
      <div className="flex items-center gap-2 text-on-surface/40">
        <Icon name={icon} size={16} />
        <span className="font-label text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className={'font-mono text-3xl font-black leading-none ' + accent}>{value}</div>
      {sub && <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-wider">{sub}</div>}
    </div>
  )
}

function AlertBanner(props) {
  var icon = props.icon
  var color = props.color
  var text = props.text
  var onClick = props.onClick
  return (
    <div
      onClick={onClick}
      className={'flex items-center gap-2 px-4 py-2.5 border rounded transition-colors ' + (onClick ? 'cursor-pointer hover:opacity-80 ' : '') + color}
    >
      <Icon name={icon} size={16} />
      <span className="font-label text-xs font-bold uppercase tracking-wider">{text}</span>
    </div>
  )
}

function QuickAction(props) {
  var icon = props.icon
  var label = props.label
  var color = props.color || 'text-primary'
  var onClick = props.onClick
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 rounded text-left transition-colors cursor-pointer"
    >
      <Icon name={icon} size={16} className={color} />
      <span className="text-xs font-bold text-on-surface">{label}</span>
    </button>
  )
}

function Sparkline(props) {
  var values = props.values || []
  var color = props.color || '#9B72CF'
  if (values.length === 0) {
    return <div className="h-[36px] flex items-center justify-center text-[10px] text-on-surface/30 font-label uppercase tracking-wider">No data</div>
  }
  var max = Math.max.apply(null, values)
  var min = Math.min.apply(null, values)
  var range = max - min || 1
  var step = values.length > 1 ? 100 / (values.length - 1) : 0
  var pts = values.map(function(v, i) {
    var y = 32 - ((v - min) / range) * 28
    return (i * step) + ',' + y
  }).join(' ')
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="w-full h-[36px]">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function OpsOverview(props) {
  var stats = props.stats
  var mrr = props.mrr
  var activeTournaments = props.activeTournaments
  var lastRefresh = props.lastRefresh
  var goTab = props.goTab
  var navigate = props.navigate
  var launch = props.launch

  if (!stats) return null

  // Prep trend data. Views are ordered DESC, so reverse to plot oldest -> newest.
  var signupVals = []
  if (launch && launch.signups && launch.signups.length) {
    signupVals = launch.signups.slice().reverse().map(function(r) { return Number(r.signups) || 0 })
  }
  var dapVals = []
  if (launch && launch.active && launch.active.length) {
    dapVals = launch.active.slice().reverse().map(function(r) { return Number(r.active_players) || 0 })
  }
  var weeklyRevVals = []
  if (launch && launch.revenue && launch.revenue.length) {
    var byWeek = {}
    launch.revenue.forEach(function(r) {
      var wk = r.week_start
      byWeek[wk] = (byWeek[wk] || 0) + (Number(r.gross_usd) || 0)
    })
    weeklyRevVals = Object.keys(byWeek).sort().map(function(k) { return byWeek[k] })
  }

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon="group" label="Players" value={stats.players} accent="text-on-surface" />
        <KpiCard icon="star" label="Active Subs" value={stats.activeSubs} accent="text-tertiary" />
        <KpiCard icon="payments" label="MRR" value={'$' + mrr.toFixed(0)} accent="text-primary" sub="Monthly recurring" />
        <KpiCard icon="emoji_events" label="Tournaments" value={stats.tournaments} accent="text-on-surface" />
        <KpiCard icon="how_to_reg" label="Registrations" value={stats.registrations} accent="text-on-surface" />
        <KpiCard icon="mail" label="Newsletter" value={stats.newsletter} accent="text-on-surface" />
        <KpiCard
          icon="gavel" label="Disputes" value={stats.openDisputes}
          accent={stats.openDisputes > 0 ? 'text-error' : 'text-on-surface'}
          pulse={stats.openDisputes > 0}
        />
      </div>

      {/* Alerts */}
      {(stats.pendingHosts > 0 || stats.openDisputes > 0 || activeTournaments.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {activeTournaments.length > 0 && (
            <AlertBanner
              icon="play_circle" color="bg-success/10 border-success/20 text-success"
              text={activeTournaments.length + ' tournament' + (activeTournaments.length > 1 ? 's' : '') + ' active'}
              onClick={function() { goTab('tournaments') }}
            />
          )}
          {stats.pendingHosts > 0 && (
            <AlertBanner
              icon="pending_actions" color="bg-secondary/10 border-secondary/20 text-secondary"
              text={stats.pendingHosts + ' pending host app' + (stats.pendingHosts > 1 ? 's' : '')}
              onClick={function() { navigate('/admin') }}
            />
          )}
          {stats.openDisputes > 0 && (
            <AlertBanner
              icon="report" color="bg-error/10 border-error/20 text-error"
              text={stats.openDisputes + ' open dispute' + (stats.openDisputes > 1 ? 's' : '')}
              onClick={function() { goTab('comms') }}
            />
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Actions */}
        <Panel className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="bolt" size={16} className="text-primary" />
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Quick Actions</span>
          </div>
          <div className="space-y-2">
            <QuickAction icon="add_circle" label="Create Tournament" color="text-primary" onClick={function() { goTab('tournaments') }} />
            <QuickAction icon="group_add" label="Manage Players" color="text-tertiary" onClick={function() { goTab('players') }} />
            <QuickAction icon="campaign" label="Send Announcement" color="text-secondary" onClick={function() { goTab('comms') }} />
            <QuickAction icon="monetization_on" label="View Revenue" color="text-primary" onClick={function() { goTab('revenue') }} />
            <QuickAction icon="dynamic_feed" label="Activity Feed" color="text-on-surface/50" onClick={function() { goTab('feed') }} />
            <QuickAction icon="view_kanban" label="Open Bracket" color="text-secondary" onClick={function() { navigate('/bracket') }} />
            <QuickAction icon="admin_panel_settings" label="Admin Panel" color="text-on-surface/50" onClick={function() { navigate('/admin') }} />
          </div>
        </Panel>

        {/* System Status */}
        <Panel className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="monitor_heart" size={16} className="text-success" />
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">System Status</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface/40 font-label uppercase tracking-wider">Database</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold text-success">Connected</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface/40 font-label uppercase tracking-wider">Active Tournaments</span>
              <span className="text-xs font-bold text-on-surface/60">
                {activeTournaments.length > 0 ? activeTournaments.length + ' running' : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface/40 font-label uppercase tracking-wider">Auto-refresh</span>
              <span className="text-xs font-bold text-on-surface/60">Every 30s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface/40 font-label uppercase tracking-wider">Last Refresh</span>
              <span className="text-xs font-bold text-on-surface/60">
                {lastRefresh ? lastRefresh.toLocaleTimeString() : '-'}
              </span>
            </div>
            <div className="border-t border-outline-variant/10 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface/40 font-label uppercase tracking-wider">Platform</span>
                <span className="text-xs font-bold text-primary">TFT Clash v1.0</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* At a Glance */}
        <Panel className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="analytics" size={16} className="text-primary" />
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">At a Glance</span>
          </div>
          {launch && launch.kpis && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded border border-outline-variant/10 p-2">
                <div className="font-label text-[9px] uppercase tracking-wider text-on-surface/40">New / 7d</div>
                <div className="font-mono text-sm font-bold text-on-surface">{launch.kpis.players_7d || 0}</div>
              </div>
              <div className="rounded border border-outline-variant/10 p-2">
                <div className="font-label text-[9px] uppercase tracking-wider text-on-surface/40">Subs / 7d</div>
                <div className="font-mono text-sm font-bold text-primary">{launch.kpis.new_subs_7d || 0}</div>
              </div>
              <div className="rounded border border-outline-variant/10 p-2">
                <div className="font-label text-[9px] uppercase tracking-wider text-on-surface/40">Tourneys / 7d</div>
                <div className="font-mono text-sm font-bold text-on-surface">{launch.kpis.tournaments_7d || 0}</div>
              </div>
              <div className="rounded border border-outline-variant/10 p-2">
                <div className="font-label text-[9px] uppercase tracking-wider text-on-surface/40">Games / 7d</div>
                <div className="font-mono text-sm font-bold text-on-surface">{launch.kpis.games_7d || 0}</div>
              </div>
            </div>
          )}
          {(signupVals.length > 0 || dapVals.length > 0 || weeklyRevVals.length > 0) && (
            <div className="space-y-2 mb-3 pb-3 border-b border-outline-variant/5">
              {signupVals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-label uppercase tracking-wider text-on-surface/40">Signups 14d</span>
                    <span className="text-[10px] font-mono text-on-surface/50">sum {signupVals.reduce(function(a, b) { return a + b }, 0)}</span>
                  </div>
                  <Sparkline values={signupVals} color="#9B72CF" />
                </div>
              )}
              {dapVals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-label uppercase tracking-wider text-on-surface/40">DAP 7d</span>
                    <span className="text-[10px] font-mono text-on-surface/50">last {dapVals[dapVals.length - 1]}</span>
                  </div>
                  <Sparkline values={dapVals} color="#6DD3A8" />
                </div>
              )}
              {weeklyRevVals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-label uppercase tracking-wider text-on-surface/40">Weekly Revenue</span>
                    <span className="text-[10px] font-mono text-on-surface/50">${weeklyRevVals[weeklyRevVals.length - 1].toFixed(0)}</span>
                  </div>
                  <Sparkline values={weeklyRevVals} color="#E8B84E" />
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-outline-variant/5">
              <span className="text-xs text-on-surface/60">Total Players</span>
              <span className="font-mono text-sm font-bold text-on-surface">{stats.players}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-outline-variant/5">
              <span className="text-xs text-on-surface/60">Paid Conversion</span>
              <span className="font-mono text-sm font-bold text-primary">
                {stats.players > 0 ? Math.round((stats.activeSubs / stats.players) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-outline-variant/5">
              <span className="text-xs text-on-surface/60">Newsletter Subs</span>
              <span className="font-mono text-sm font-bold text-on-surface">{stats.newsletter}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-on-surface/60">Revenue / Player</span>
              <span className="font-mono text-sm font-bold text-primary">
                ${stats.players > 0 ? (mrr / stats.players).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
