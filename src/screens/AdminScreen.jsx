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
        <div className="flex items-center gap-2 mb-6">
          <Icon name="admin_panel_settings" size={20} className="text-primary" />
          <h1 className="font-editorial text-xl font-bold text-on-surface">Admin Panel</h1>
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
