import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Icon } from '../components/ui'
import LeaderboardScreen from './LeaderboardScreen'
import HofScreen from './HofScreen'

var TABS = [
  { id: '', label: 'Leaderboard', icon: 'emoji_events' },
  { id: 'hof', label: 'Hall of Fame', icon: 'workspace_premium' },
  { id: 'roster', label: 'Player Directory', icon: 'groups' },
]

export default function StandingsScreen() {
  var { subRoute } = useApp()
  var tab = subRoute || ''
  var navigate = useNavigate()

  function handleTabClick(tabId) {
    var path = tabId ? '/standings/' + tabId : '/standings'
    navigate(path)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Standings"
        description="Season rankings, legends, and the full player roster"
      />

      <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-1">
        {TABS.map(function(t) {
          var active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={function() { handleTabClick(t.id) }}
              className={
                'flex items-center gap-2 px-5 py-2.5 rounded-sm border font-sans text-sm font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ' +
                (active
                  ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                  : 'bg-surface-container-low/40 border-outline-variant/10 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low')
              }
            >
              <Icon
                name={t.icon}
                size={18}
                fill={active}
                className={active ? 'text-primary' : 'text-on-surface/50'}
              />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === '' && <LeaderboardScreen embedded={true} />}

      {tab === 'hof' && <HofScreen embedded={true} />}

      {tab === 'roster' && (
        <Panel className="text-center py-16">
          <Icon name="groups" size={48} className="text-tertiary/30 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-on-surface mb-2">Player Directory</h2>
          <p className="text-on-surface-variant text-sm">Coming soon - Browse all registered players.</p>
        </Panel>
      )}
    </PageLayout>
  )
}
