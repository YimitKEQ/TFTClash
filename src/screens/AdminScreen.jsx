import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Icon, PillTab, PillTabGroup } from '../components/ui'
import OverviewTab from './admin/OverviewTab'
import PlayersTab from './admin/PlayersTab'
import TournamentTab from './admin/TournamentTab'
import ResultsTab from './admin/ResultsTab'
import SettingsTab from './admin/SettingsTab'
import AuditTab from './admin/AuditTab'
import HostsTab from './admin/HostsTab'
import SponsorsTab from './admin/SponsorsTab'
import LinksTab from './admin/LinksTab'
import TeamsTab from './admin/TeamsTab'
import PayoutsTab from './admin/PayoutsTab'

var TABS = [
  { id: 'overview',    label: 'Overview',    icon: 'dashboard' },
  { id: 'players',     label: 'Players',     icon: 'group' },
  { id: 'tournament',  label: 'Tournament',  icon: 'emoji_events' },
  { id: 'teams',       label: '4v4 Teams',   icon: 'groups' },
  { id: 'results',     label: 'Results',     icon: 'leaderboard' },
  { id: 'payouts',     label: 'Payouts',     icon: 'payments' },
  { id: 'hosts',       label: 'Hosts',       icon: 'verified_user' },
  { id: 'sponsors',    label: 'Sponsors',    icon: 'handshake' },
  { id: 'links',       label: 'Links',       icon: 'link' },
  { id: 'settings',    label: 'Settings',    icon: 'settings' },
  { id: 'audit',       label: 'Audit Log',   icon: 'assignment' },
]

export default function AdminScreen() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var hostApps = ctx.hostApps

  var _tab = useState('overview')
  var tab = _tab[0]
  var setTab = _tab[1]

  if (!isAdmin) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-on-surface/40">
            <Icon name="lock" size={40} className="block mx-auto mb-3" />
            <div className="text-sm font-semibold">Admin access required</div>
          </div>
        </div>
      </PageLayout>
    )
  }

  var pendingHosts = (hostApps || []).filter(function(a) { return a.status === 'pending' }).length

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/30 bg-primary/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">Admin</span>
            </span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/40">Operations Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="admin_panel_settings" size={22} className="text-primary" />
            <h1 className="font-display text-2xl font-black uppercase tracking-tight text-on-surface">Command Center</h1>
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-primary/30 via-outline-variant/20 to-transparent"></div>
        </div>

        <PillTabGroup align="start" className="mb-6">
          {TABS.map(function(t) {
            var badge = t.id === 'hosts' && pendingHosts > 0 ? pendingHosts : null
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={tab === t.id}
                onClick={function() { setTab(t.id) }}
              >
                {t.label}
                {badge && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-error text-white rounded-full leading-none">
                    {badge}
                  </span>
                )}
              </PillTab>
            )
          })}
        </PillTabGroup>

        <div>
          {tab === 'overview'   && <OverviewTab setTab={setTab} />}
          {tab === 'players'    && <PlayersTab />}
          {tab === 'tournament' && <TournamentTab />}
          {tab === 'teams'      && <TeamsTab />}
          {tab === 'results'    && <ResultsTab />}
          {tab === 'payouts'    && <PayoutsTab />}
          {tab === 'hosts'      && <HostsTab />}
          {tab === 'sponsors'   && <SponsorsTab />}
          {tab === 'links'      && <LinksTab />}
          {tab === 'settings'   && <SettingsTab />}
          {tab === 'audit'      && <AuditTab />}
        </div>
      </div>
    </PageLayout>
  )
}
