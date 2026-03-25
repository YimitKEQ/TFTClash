import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

var PLAYER_FEATURES = [
  { text: 'Compete in weekly clashes - always free', icon: 'sports_esports' },
  { text: 'Global leaderboard', icon: 'leaderboard' },
  { text: 'Basic match history (last 10)', icon: 'history' },
  { text: 'Public profile page', icon: 'person' },
]

var PRO_FEATURES = [
  { text: 'Auto check-in for weekly clash', icon: 'check_circle' },
  { text: 'Priority registration (10 min early)', icon: 'schedule' },
  { text: 'Pro badge on profile', icon: 'verified' },
  { text: 'Extended match history (full career)', icon: 'history' },
  { text: 'Advanced stat breakdowns (placement rates, avg by comp, etc.)', icon: 'bar_chart' },
  { text: 'Custom profile banner', icon: 'wallpaper' },
  { text: 'Scrim access - run private practice lobbies', icon: 'group' },
  { text: 'Early access to new features', icon: 'new_releases' },
  { text: 'Pro Discord role + exclusive channels', icon: 'forum' },
]

var HOST_FEATURES = [
  { text: 'Custom branded tournament pages', icon: 'storefront' },
  { text: 'Full tournament orchestration tools', icon: 'account_tree' },
  { text: 'Up to 128-player brackets', icon: 'device_hub' },
  { text: 'Custom prize pool management', icon: 'emoji_events' },
  { text: 'Revenue sharing on prize pools', icon: 'payments' },
  { text: 'Analytics dashboard', icon: 'insights' },
  { text: 'Dedicated onboarding', icon: 'person_check' },
  { text: 'Priority support channel', icon: 'support_agent' },
]

var COMPARISON_ROWS = [
  {
    label: 'Weekly clash entry',
    player: true,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Match history',
    player: 'Last 10',
    pro: 'Full career',
    host: 'Full career',
    proHighlight: true,
    hostHighlight: true,
    type: 'text',
  },
  {
    label: 'Auto check-in',
    player: false,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Priority registration',
    player: false,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Advanced stat breakdowns',
    player: false,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Scrim lobbies',
    player: false,
    pro: true,
    host: true,
    type: 'bool',
  },
  {
    label: 'Tournament hosting',
    player: false,
    pro: false,
    host: true,
    type: 'bool',
  },
  {
    label: 'Max bracket size',
    player: '-',
    pro: '-',
    host: '128 players',
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
  {
    q: 'How does Enterprise pricing work?',
    a: 'Enterprise is custom-priced based on your community size and needs. Reach out and we will put together a package that fits.',
  },
  {
    q: 'Can I trial the Host tools?',
    a: 'Yes, approved hosts get a 14-day trial period before billing starts. No credit card required upfront.',
  },
]

function BoolCell(props) {
  var value = props.value
  var colorClass = props.colorClass
  if (value) {
    return (
      <div className={'flex justify-center ' + colorClass}>
        <Icon name="check" size={20} fill />
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
  var navigate = useNavigate()

  function handleGetStarted() {
    if (currentUser) {
      navigate('/dashboard')
    } else {
      navigate('/signup')
    }
  }

  function handleContactSupport() {
    window.location.href = 'mailto:support@tftclash.com'
  }

  function handleEnterpriseContact() {
    window.location.href = 'mailto:hello@tftclash.com'
  }

  var isPlayer = userTier === 'free'
  var isPro = userTier === 'pro'
  var isHost = userTier === 'host'

  return (
    <PageLayout showSidebar={false}>
      <div className="max-w-7xl mx-auto px-6 py-16">

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

          {/* Player Tier */}
          <div className="bg-surface-container-low p-8 rounded-[4px] border-t-2 border-outline-variant/20 transition-all hover:bg-surface-container">
            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-on-surface-variant font-bold">
                Entry Level
              </span>
              <h3 className="font-serif text-4xl mt-2">Player</h3>
              <div className="flex items-baseline mt-4">
                <span className="font-display text-5xl">$0</span>
                <span className="font-mono text-sm ml-2 opacity-60">/MONTH</span>
              </div>
            </div>

            <div className="space-y-5 mb-12">
              {PLAYER_FEATURES.map(function(f) {
                return (
                  <div key={f.text} className="flex items-start gap-3">
                    <Icon name={f.icon} size={20} className="text-primary shrink-0 mt-0.5" />
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
              <button
                onClick={handleGetStarted}
                className="w-full py-4 rounded-[20px] font-sans font-bold uppercase tracking-widest bg-surface-variant/20 border border-outline-variant/15 hover:bg-surface-variant transition-all"
                style={{ boxShadow: '0 40px 40px rgba(228,225,236,0.06)' }}
              >
                Get Started
              </button>
            )}
          </div>

          {/* Pro Tier - Highlighted */}
          <div
            className="relative bg-surface-container-high p-8 rounded-[4px] border-t-4 border-primary -mt-4 scale-105 z-10"
            style={{ boxShadow: '0 40px 40px rgba(228,225,236,0.06)' }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full font-sans font-bold text-[10px] tracking-tighter uppercase whitespace-nowrap">
              Most Popular
            </div>

            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-primary font-bold">
                Ascendant
              </span>
              <h3 className="font-serif text-4xl mt-2">Pro</h3>
              <div className="flex items-baseline mt-4">
                <span className="font-display text-5xl">$4.99</span>
                <span className="font-mono text-sm ml-2 opacity-60">/MONTH</span>
              </div>
            </div>

            <div className="space-y-5 mb-12">
              {PRO_FEATURES.map(function(f) {
                return (
                  <div key={f.text} className="flex items-start gap-3">
                    <Icon name={f.icon} size={20} className="text-primary shrink-0 mt-0.5" />
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
              <div className="w-full py-2.5 text-center rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface/40 text-xs font-semibold tracking-widest uppercase cursor-default select-none">
                Coming Soon
              </div>
            )}
          </div>

          {/* Enterprise / Host Tier */}
          <div className="bg-surface-container-low p-8 rounded-[4px] border-t-2 border-tertiary/50 transition-all hover:bg-surface-container ring-1 ring-tertiary/20">
            <div className="mb-10">
              <span className="font-sans uppercase tracking-widest text-xs text-tertiary font-bold">
                Enterprise
              </span>
              <h3 className="font-serif text-4xl mt-2">Host</h3>
              <div className="flex items-baseline mt-4">
                <span className="font-display text-3xl text-tertiary">Custom Pricing</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
                For organisations, content creators and serious community builders who want to run their own branded TFT leagues.
              </p>
            </div>

            <div className="space-y-5 mb-12">
              {HOST_FEATURES.map(function(f) {
                return (
                  <div key={f.text} className="flex items-start gap-3">
                    <Icon name={f.icon} size={20} className="text-tertiary shrink-0 mt-0.5" />
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
              <button
                onClick={handleEnterpriseContact}
                className="w-full py-4 rounded-[20px] font-sans font-bold uppercase tracking-widest bg-tertiary/10 border border-tertiary/30 text-tertiary hover:bg-tertiary/20 transition-all"
              >
                Get in Touch
              </button>
            )}
          </div>
        </div>

        {/* Promo Banner */}
        <section className="mt-24 relative overflow-hidden rounded-[4px] bg-surface-container-lowest p-12 border border-outline-variant/10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-display text-4xl mb-4 tracking-tighter">
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
                EUW - EUNE - NA
              </div>
              <div className="flex items-center gap-2">
                <Icon name="groups" size={16} />
                Community Moderated
              </div>
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="mt-32">
          <h2 className="font-serif text-5xl mb-16">The Specification</h2>
          <div className="w-full overflow-hidden">
            <div className="grid grid-cols-4 gap-4 pb-6 border-b border-outline-variant/20 font-sans uppercase tracking-[0.2em] text-[10px] text-on-surface-variant">
              <div className="col-span-1">Feature Sets</div>
              <div className="text-center">Player</div>
              <div className="text-center text-primary">Pro</div>
              <div className="text-center text-tertiary">Host</div>
            </div>

            <div className="space-y-4 py-8">
              {COMPARISON_ROWS.map(function(row, i) {
                var isAlt = i % 2 === 0
                return (
                  <div
                    key={row.label}
                    className={'grid grid-cols-4 gap-4 items-center p-4 rounded-[2px]' + (isAlt ? ' bg-surface-container-low' : '')}
                  >
                    <div className="font-body text-sm">{row.label}</div>

                    {row.type === 'bool' ? (
                      <>
                        <BoolCell value={row.player} colorClass="text-primary" />
                        <BoolCell value={row.pro} colorClass="text-primary" />
                        <BoolCell value={row.host} colorClass="text-tertiary" />
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-center text-sm opacity-60">{row.player}</div>
                        <div className={'font-mono text-center text-sm' + (row.proHighlight ? ' text-primary font-bold' : ' opacity-60')}>
                          {row.pro}
                        </div>
                        <div className={'font-mono text-center text-sm' + (row.hostHighlight ? ' text-tertiary font-bold' : ' opacity-60')}>
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
        <section className="mt-32 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h4 className="font-sans uppercase tracking-widest text-xs text-primary mb-2">
              Inquiries
            </h4>
            <h2 className="font-serif text-4xl mb-6">Frequently Asked Questions</h2>
            <p className="text-on-surface-variant">
              Still unsure which path to tread? Our support command center is active via Discord to assist your ascent.
            </p>
            <div className="mt-8 flex gap-4">
              <button
                onClick={handleContactSupport}
                className="bg-surface-container-highest px-6 py-3 rounded-[20px] text-sm font-sans font-bold uppercase tracking-widest border border-outline-variant/20 hover:bg-surface-variant transition-colors"
              >
                Email Support
              </button>
              <button
                onClick={handleEnterpriseContact}
                className="bg-tertiary/10 border border-tertiary/30 text-tertiary px-6 py-3 rounded-[20px] text-sm font-sans font-bold uppercase tracking-widest hover:bg-tertiary/20 transition-colors"
              >
                Enterprise Enquiry
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map(function(item) {
              return (
                <div key={item.q} className="p-6 bg-surface-container-low rounded-[4px]">
                  <h5 className="font-bold mb-2">{item.q}</h5>
                  <p className="text-sm text-on-surface-variant">{item.a}</p>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </PageLayout>
  )
}
