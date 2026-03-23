import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'

var PLAYER_FEATURES = [
  { text: 'Compete in every clash', locked: false },
  { text: 'Full standings and leaderboard', locked: false },
  { text: 'Basic profile with stats', locked: false },
  { text: 'View all results and recaps', locked: false },
  { text: 'Current season history', locked: false },
  { text: 'Premium prize pools', locked: true },
]

var PRO_FEATURES = [
  { text: 'Exclusive Pro Circuit access', icon: 'verified' },
  { text: 'Enhanced stats and consistency grade', icon: 'check_circle' },
  { text: 'Pro badge on profile', icon: 'check_circle' },
  { text: 'Priority registration', icon: 'check_circle' },
  { text: 'Full career history (all seasons)', icon: 'check_circle' },
  { text: 'Custom profile banner', icon: 'check_circle' },
  { text: 'Player comparison tool', icon: 'check_circle' },
  { text: 'Weekly email digest', icon: 'check_circle' },
]

var HOST_FEATURES = [
  { text: 'Create custom tournaments', icon: 'account_tree' },
  { text: 'Branded tournament pages', icon: 'check_circle' },
  { text: 'Host analytics dashboard', icon: 'check_circle' },
  { text: 'Custom rules and formats', icon: 'check_circle' },
  { text: 'Player management tools', icon: 'check_circle' },
  { text: 'Priority support', icon: 'check_circle' },
]

var COMPARISON_ROWS = [
  {
    label: 'Max Monthly Tournaments',
    player: '10',
    pro: 'Unlimited',
    host: 'Unlimited',
    proHighlight: true,
    hostHighlight: true,
    type: 'text',
  },
  {
    label: 'Advanced LP Analytics',
    player: false,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Custom Match Lobbies',
    player: false,
    pro: false,
    host: true,
    type: 'bool',
  },
  {
    label: 'Tournament Broadcasting Tools',
    player: false,
    pro: false,
    host: true,
    type: 'bool',
  },
  {
    label: 'Profile Customization',
    player: 'Basic',
    pro: 'Full Access',
    host: 'Full Access',
    proHighlight: true,
    hostHighlight: true,
    type: 'text',
  },
]

var FAQ_ITEMS = [
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Tier changes are applied immediately, and billing is prorated to your next cycle.',
  },
  {
    q: 'Do Pro members get an advantage in games?',
    a: 'Never. Membership provides cosmetic and analytical tools. We maintain strict competitive integrity - no pay-to-win mechanics exist in the Arena.',
  },
]

function CheckIcon({ color }) {
  return (
    <Icon name="check_circle" size={20} fill className={color} />
  )
}

function LockIcon() {
  return (
    <Icon name="lock" size={20} className="text-on-surface/30" />
  )
}

function BoolCell({ value, proColor, hostColor, isHost }) {
  if (value) {
    return (
      <div className="flex justify-center">
        <Icon name="check" size={20} fill className={isHost ? hostColor : proColor} />
      </div>
    )
  }
  return (
    <div className="flex justify-center opacity-20">
      <Icon name="close" size={20} />
    </div>
  )
}

export default function PricingScreen() {
  var app = useApp()
  var currentUser = app.currentUser
  var userTier = app.userTier || 'free'
  var toast = app.toast
  var navigate = useNavigate()

  function handleGetStarted() {
    if (currentUser) {
      navigate('/dashboard')
    } else {
      navigate('/signup')
    }
  }

  function handleBecomePro() {
    toast('Subscriptions launching soon - stay tuned!', 'info')
  }

  function handleStartHosting() {
    toast('Subscriptions launching soon - stay tuned!', 'info')
  }

  function handleContactSupport() {
    navigate('/faq')
  }

  var isPlayer = userTier === 'free'
  var isPro = userTier === 'pro'
  var isHost = userTier === 'host'

  return (
    <PageLayout showSidebar={false}>
      <div className="py-8">
        {/* Header */}
        <header className="text-center mb-20">
          <h1 className="font-serif text-6xl md:text-8xl mb-6 text-on-surface">
            Choose Your Path
          </h1>
          <p className="font-sans text-xl uppercase tracking-[0.3em] text-primary opacity-80">
            Battle. Ascend. Dominate.
          </p>
        </header>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-24">
          {/* Player Tier */}
          <div className="bg-surface-container-low p-8 rounded-sm border-t-2 border-outline-variant/20 transition-all hover:bg-surface-container">
            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-on-surface-variant font-bold">
                Entry Level
              </span>
              <h3 className="font-serif text-4xl mt-2">Player</h3>
              <div className="flex items-baseline mt-4 gap-2">
                <span className="font-mono text-5xl font-bold">$0</span>
                <span className="font-mono text-sm opacity-60">/MONTH</span>
              </div>
            </div>

            <div className="space-y-4 mb-12">
              {PLAYER_FEATURES.map(function(f) {
                return (
                  <div
                    key={f.text}
                    className={'flex items-center gap-3' + (f.locked ? ' opacity-30' : '')}
                  >
                    {f.locked
                      ? <LockIcon />
                      : <CheckIcon color="text-primary" />
                    }
                    <span className="text-sm">{f.text}</span>
                  </div>
                )
              })}
            </div>

            {isPlayer && currentUser ? (
              <div className="text-center py-3 text-sm font-bold text-success">
                Current Plan
              </div>
            ) : (
              <Btn
                variant="secondary"
                size="xl"
                onClick={handleGetStarted}
              >
                Get Started
              </Btn>
            )}
          </div>

          {/* Pro Tier - Highlighted */}
          <div className="relative bg-surface-container-high p-8 rounded-sm border-t-4 border-primary shadow-lg shadow-primary/10 -mt-4 scale-105 z-10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full font-sans font-bold text-[10px] tracking-tighter uppercase whitespace-nowrap">
              Most Popular
            </div>

            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-primary font-bold">
                Ascendant
              </span>
              <h3 className="font-serif text-4xl mt-2">Pro</h3>
              <div className="flex items-baseline mt-4 gap-2">
                <span className="font-mono text-5xl font-bold">$4.99</span>
                <span className="font-mono text-sm opacity-60">/MONTH</span>
              </div>
            </div>

            <div className="space-y-4 mb-12">
              {PRO_FEATURES.map(function(f) {
                return (
                  <div key={f.text} className="flex items-center gap-3">
                    <Icon name={f.icon} size={20} fill className="text-primary" />
                    <span className="text-sm">{f.text}</span>
                  </div>
                )
              })}
            </div>

            {isPro ? (
              <div className="text-center py-3 text-sm font-bold text-success">
                Current Plan
              </div>
            ) : (
              <Btn
                variant="primary"
                size="xl"
                onClick={handleBecomePro}
              >
                Become A Pro
              </Btn>
            )}
          </div>

          {/* Host Tier */}
          <div className="bg-surface-container-low p-8 rounded-sm border-t-2 border-secondary/40 transition-all hover:bg-surface-container">
            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-secondary font-bold">
                Architect
              </span>
              <h3 className="font-serif text-4xl mt-2">Host</h3>
              <div className="flex items-baseline mt-4 gap-2">
                <span className="font-mono text-5xl font-bold">$19.99</span>
                <span className="font-mono text-sm opacity-60">/MONTH</span>
              </div>
            </div>

            <div className="space-y-4 mb-12">
              {HOST_FEATURES.map(function(f) {
                return (
                  <div key={f.text} className="flex items-center gap-3">
                    <Icon name={f.icon} size={20} fill className="text-secondary" />
                    <span className="text-sm">{f.text}</span>
                  </div>
                )
              })}
            </div>

            {isHost ? (
              <div className="text-center py-3 text-sm font-bold text-success">
                Current Plan
              </div>
            ) : (
              <Btn
                variant="secondary"
                size="xl"
                onClick={handleStartHosting}
                className="border-secondary/40 hover:bg-secondary/10"
              >
                Start Hosting
              </Btn>
            )}
          </div>
        </div>

        {/* Promo Banner */}
        <section className="relative overflow-hidden rounded-sm bg-surface-container-low p-12 border border-outline-variant/10 text-center mb-32">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-mono text-4xl font-bold mb-4 tracking-tighter">
              FREE TO COMPETE, ALWAYS.
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto mb-8">
              Our core competitive ecosystem remains accessible to every tactician.
              We believe in meritocracy. The arena is open - your legend begins with a single match.
            </p>
            <div className="inline-flex items-center gap-8 font-mono text-xs opacity-50 uppercase flex-wrap justify-center">
              <div className="flex items-center gap-2">
                <Icon name="verified_user" size={16} />
                Fair Play Guaranteed
              </div>
              <div className="flex items-center gap-2">
                <Icon name="public" size={16} />
                Global Servers
              </div>
              <div className="flex items-center gap-2">
                <Icon name="security" size={16} />
                Anti-Cheat Engine
              </div>
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="mb-32">
          <h2 className="font-serif text-5xl mb-16">The Specification</h2>
          <div className="w-full overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 pb-6 border-b border-outline-variant/20 font-sans uppercase tracking-[0.2em] text-[10px] text-on-surface-variant">
              <div className="col-span-1">Feature Sets</div>
              <div className="text-center">Player</div>
              <div className="text-center text-primary">Pro</div>
              <div className="text-center text-secondary">Host</div>
            </div>

            {/* Table Rows */}
            <div className="space-y-2 py-6">
              {COMPARISON_ROWS.map(function(row, i) {
                var isAlt = i % 2 === 0
                return (
                  <div
                    key={row.label}
                    className={'grid grid-cols-4 gap-4 items-center p-4 rounded-sm' + (isAlt ? ' bg-surface-container-low' : '')}
                  >
                    <div className="font-sans text-sm">{row.label}</div>

                    {row.type === 'bool' ? (
                      <>
                        <BoolCell value={row.player} proColor="text-primary" hostColor="text-secondary" isHost={false} />
                        <BoolCell value={row.pro} proColor="text-primary" hostColor="text-secondary" isHost={false} />
                        <BoolCell value={row.host} proColor="text-primary" hostColor="text-secondary" isHost={true} />
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-center text-sm opacity-60">{row.player}</div>
                        <div className={'font-mono text-center text-sm' + (row.proHighlight ? ' text-primary font-bold' : ' opacity-60')}>
                          {row.pro}
                        </div>
                        <div className={'font-mono text-center text-sm' + (row.hostHighlight ? ' text-secondary font-bold' : ' opacity-60')}>
                          {row.host}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h4 className="font-sans uppercase tracking-widest text-xs text-primary mb-2">
              Inquiries
            </h4>
            <h2 className="font-serif text-4xl mb-6">Frequently Asked Questions</h2>
            <p className="text-on-surface-variant">
              Still unsure which path to tread? Our support command center is active 24/7 to assist your ascent.
            </p>
            <div className="mt-8">
              <Btn variant="secondary" size="md" onClick={handleContactSupport}>
                Contact Support
              </Btn>
            </div>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map(function(item) {
              return (
                <Panel key={item.q} className="p-6">
                  <h5 className="font-bold mb-2">{item.q}</h5>
                  <p className="text-sm text-on-surface-variant">{item.a}</p>
                </Panel>
              )
            })}
          </div>
        </section>
      </div>
    </PageLayout>
  )
}
