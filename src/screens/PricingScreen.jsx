import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon, Panel } from '../components/ui'
import { TIER_PRICES, getSubscribeUrl, getDonateUrl } from '../lib/paypal'

// ─── Feature lists per tier ─────────────────────────────────────────────────

var FREE_FEATURES = [
  { text: 'Compete in weekly clashes', icon: 'sports_esports' },
  { text: 'Global leaderboard', icon: 'leaderboard' },
  { text: 'Basic match history (last 10)', icon: 'history' },
  { text: 'Public profile page', icon: 'person' },
  { text: 'Join scrim rooms as participant', icon: 'group' },
]

var PRO_FEATURES = [
  { text: 'Everything in Free, plus:', icon: 'add_circle', dim: true },
  { text: 'Ad-free browsing', icon: 'block' },
  { text: 'Priority registration (10 min early)', icon: 'schedule' },
  { text: 'Pro badge on profile', icon: 'verified' },
  { text: 'Full career match history', icon: 'history' },
  { text: 'Advanced stat breakdowns', icon: 'bar_chart' },
  { text: 'Custom profile banner', icon: 'wallpaper' },
  { text: 'Season recap and achievements', icon: 'emoji_events' },
  { text: 'Pro Discord role', icon: 'forum' },
]

var SCRIM_FEATURES = [
  { text: 'Everything in Free, plus:', icon: 'add_circle', dim: true },
  { text: 'Create scrim rooms (up to 32 players)', icon: 'meeting_room' },
  { text: 'Multi-lobby seeding (Swiss, Snake, Random)', icon: 'swap_vert' },
  { text: 'Full scrim stats and leaderboards', icon: 'analytics' },
  { text: 'Scrim tournaments and seasons', icon: 'account_tree' },
  { text: 'Room customization', icon: 'tune' },
]

var BUNDLE_FEATURES = [
  { text: 'All Pro features', icon: 'verified', highlight: true },
  { text: 'All Scrim Pass features', icon: 'meeting_room', highlight: true },
  { text: 'Best value - save 2.99/mo', icon: 'savings' },
]

var HOST_FEATURES = [
  { text: 'Everything in Pro + Scrim, plus:', icon: 'add_circle', dim: true },
  { text: 'Custom branded tournament pages', icon: 'storefront' },
  { text: 'Full tournament orchestration', icon: 'account_tree' },
  { text: 'Up to 128-player brackets', icon: 'device_hub' },
  { text: 'Entry fee collection (15% platform fee)', icon: 'payments' },
  { text: 'Analytics dashboard', icon: 'insights' },
  { text: 'Verified Host badge', icon: 'verified_user' },
  { text: 'Priority support', icon: 'support_agent' },
]

// ─── Comparison table ───────────────────────────────────────────────────────

var COMPARISON_ROWS = [
  { label: 'Weekly clash entry',       free: true,       pro: true,       scrim: true,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Match history',            free: 'Last 10',  pro: 'Full',     scrim: 'Last 10',  bundle: 'Full',     host: 'Full',     type: 'text' },
  { label: 'Ad-free browsing',          free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Priority registration',    free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Pro badge',                free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Advanced stats',           free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Custom banner',            free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
  { label: 'Join scrim rooms',         free: true,       pro: true,       scrim: true,        bundle: true,       host: true,       type: 'bool' },
  { label: 'Create scrim rooms',       free: false,      pro: false,      scrim: true,        bundle: true,       host: true,       type: 'bool' },
  { label: 'Max scrim players',        free: '-',        pro: '-',        scrim: '32',        bundle: '32',       host: '32',       type: 'text' },
  { label: 'Multi-lobby seeding',      free: false,      pro: false,      scrim: true,        bundle: true,       host: true,       type: 'bool' },
  { label: 'Scrim stats',              free: false,      pro: false,      scrim: true,        bundle: true,       host: true,       type: 'bool' },
  { label: 'Tournament hosting',       free: false,      pro: false,      scrim: false,       bundle: false,      host: true,       type: 'bool' },
  { label: 'Branded pages',            free: false,      pro: false,      scrim: false,       bundle: false,      host: true,       type: 'bool' },
  { label: 'Entry fee collection',     free: false,      pro: false,      scrim: false,       bundle: false,      host: true,       type: 'bool' },
  { label: 'Discord role',             free: false,      pro: true,       scrim: false,       bundle: true,       host: true,       type: 'bool' },
]

var FAQ_ITEMS = [
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Tier changes are applied immediately. Your billing is prorated to the next cycle.',
  },
  {
    q: 'Do paid members get an advantage in games?',
    a: 'Never. Membership provides cosmetic and analytical tools only. We maintain strict competitive integrity.',
  },
  {
    q: 'What is a Scrim Pass?',
    a: 'The Scrim Pass lets you create private practice rooms for up to 32 players with multi-lobby seeding. Perfect for friend groups and practice squads.',
  },
  {
    q: 'How does Host work?',
    a: 'Host is application-based. Once approved, you get full tournament tools, branded pages, and can collect entry fees. We take a 15% platform fee on entry fees.',
  },
  {
    q: 'Can I just buy Scrim without Pro?',
    a: 'Yes. Scrim Pass and Pro are separate products for different needs. If you want both, the Pro + Scrim bundle saves you \u20AC2.99/mo.',
  },
]

// ─── Components ─────────────────────────────────────────────────────────────

function BoolCell(props) {
  var value = props.value
  if (value) {
    return (
      <div className="flex justify-center text-primary">
        <Icon name="check" size={18} fill />
      </div>
    )
  }
  return (
    <div className="flex justify-center opacity-20">
      <Icon name="close" size={18} />
    </div>
  )
}

function TierCard(props) {
  var tier = props.tier
  var label = props.label
  var subtitle = props.subtitle
  var price = props.price
  var priceNote = props.priceNote
  var features = props.features
  var accent = props.accent || 'primary'
  var highlighted = props.highlighted
  var currentTier = props.currentTier
  var currentUser = props.currentUser
  var cta = props.cta
  var navigate = props.navigate

  var isCurrent = currentTier === tier
  var subscribeUrl = currentUser ? getSubscribeUrl(tier, currentUser.auth_user_id || currentUser.id) : null
  var accentText = accent === 'tertiary' ? 'text-tertiary' : 'text-primary'
  var panelClass = 'relative flex flex-col transition-all hover:bg-surface-container'
  if (highlighted) {
    panelClass += ' ring-2 ring-primary/40 -mt-2 z-10'
  }

  function handleSignupClick() {
    navigate(currentUser ? '/dashboard' : '/signup')
  }
  function handleApplyClick() {
    navigate('/host/apply')
  }
  function handleSubscribeClick() {
    navigate('/signup')
  }

  return (
    <Panel padding="default" className={panelClass}>
      {highlighted ? (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full font-label font-bold text-[10px] tracking-tighter uppercase whitespace-nowrap">
          Best Value
        </div>
      ) : null}

      <div className="mb-6">
        <span className={'font-label uppercase tracking-widest text-xs font-bold ' + accentText}>
          {subtitle}
        </span>
        <h3 className="font-serif text-3xl mt-1">{label}</h3>
        <div className="flex items-baseline mt-3">
          {price === 0 ? (
            <span className="font-display text-4xl">Free</span>
          ) : (
            <>
              <span className="font-display text-4xl">{'\u20AC' + price}</span>
              <span className="font-mono text-xs ml-2 opacity-60">/mo</span>
            </>
          )}
        </div>
        {priceNote ? (
          <p className="text-xs text-on-surface-variant/60 mt-1">{priceNote}</p>
        ) : null}
      </div>

      <div className="space-y-3 mb-8 flex-1">
        {features.map(function(f) {
          return (
            <div key={f.text} className={'flex items-start gap-2.5' + (f.dim ? ' opacity-50' : '')}>
              <Icon name={f.icon} size={18} className={accentText + ' shrink-0 mt-0.5'} />
              <span className="text-sm leading-snug">{f.text}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto">
        {isCurrent && currentUser ? (
          <div className="text-center py-3 text-sm font-bold text-success flex items-center justify-center gap-2">
            <Icon name="check_circle" size={18} fill />
            Current Plan
          </div>
        ) : cta === 'signup' ? (
          <Btn variant="secondary" size="xl" onClick={handleSignupClick}>
            Get Started
          </Btn>
        ) : cta === 'apply' ? (
          <Btn variant="tertiary" size="xl" onClick={handleApplyClick}>
            Apply Now
          </Btn>
        ) : currentUser ? (
          subscribeUrl ? (
            <a
              href={subscribeUrl}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-widest transition-all duration-300 py-5 text-sm min-h-[56px] bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 hover:shadow-[0_0_30px_rgba(232,168,56,0.3)] hover:scale-[1.02] active:scale-95"
            >
              Subscribe
            </a>
          ) : (
            <div className="w-full py-3 text-center rounded-full bg-surface-container border border-outline-variant/20 text-on-surface/40 text-xs font-label font-semibold tracking-widest uppercase cursor-default select-none">
              Coming Soon
            </div>
          )
        ) : (
          <Btn variant="primary" size="xl" onClick={handleSubscribeClick}>
            Sign Up to Subscribe
          </Btn>
        )}
      </div>
    </Panel>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PricingScreen() {
  var app = useApp()
  var currentUser = app.currentUser
  var userTier = app.userTier || 'free'
  var navigate = useNavigate()

  function handleHostApplyClick() {
    navigate('/host/apply')
  }

  return (
    <PageLayout showSidebar={false}>
      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="font-editorial italic text-5xl md:text-7xl mb-4 text-on-surface">
            Competing is always free.
          </h1>
          <p className="font-label text-sm uppercase tracking-[0.2em] text-on-surface-variant opacity-60 max-w-lg mx-auto">
            Pro gives you the edge. Scrim Pass unlocks private practice. Host runs your league.
          </p>
        </header>

        {/* Pricing Cards - 5 tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">

          <TierCard
            tier="free"
            label="Player"
            subtitle="Entry Level"
            price={0}
            features={FREE_FEATURES}
            currentTier={userTier}
            currentUser={currentUser}

            navigate={navigate}
            cta="signup"
          />

          <TierCard
            tier="pro"
            label="Pro"
            subtitle="Ascendant"
            price={TIER_PRICES.pro}
            features={PRO_FEATURES}
            currentTier={userTier}
            currentUser={currentUser}


            navigate={navigate}

          />

          <TierCard
            tier="scrim"
            label="Scrim Pass"
            subtitle="Practice Squad"
            price={TIER_PRICES.scrim}
            features={SCRIM_FEATURES}
            currentTier={userTier}
            currentUser={currentUser}


            navigate={navigate}

          />

          <TierCard
            tier="bundle"
            label="Pro + Scrim"
            subtitle="Best Value"
            price={TIER_PRICES.bundle}
            priceNote="Save 2.99/mo vs buying separately"
            features={BUNDLE_FEATURES}
            highlighted={true}
            currentTier={userTier}
            currentUser={currentUser}


            navigate={navigate}

          />

          <TierCard
            tier="host"
            label="Host"
            subtitle="Tournament Organizer"
            price={TIER_PRICES.host}
            priceNote="Application required"
            features={HOST_FEATURES}
            accent="tertiary"
            currentTier={userTier}
            currentUser={currentUser}


            navigate={navigate}

            cta="apply"
          />

        </div>

        {/* Free-to-compete banner */}
        <Panel padding="spacious" elevation="low" className="mt-20 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-display text-3xl mb-3 tracking-tighter">
              FREE TO COMPETE, ALWAYS.
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto mb-6 text-sm">
              Our core competitive ecosystem remains accessible to every tactician.
              We believe in meritocracy. The arena is open.
            </p>
            <div className="inline-flex items-center gap-6 font-mono text-xs opacity-50 uppercase flex-wrap justify-center">
              <div className="flex items-center gap-2">
                <Icon name="verified_user" size={16} />
                Fair Play
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
        </Panel>

        {/* Donation Section */}
        {getDonateUrl() ? (
          <section className="mt-16 text-center">
            <Panel padding="spacious" className="inline-flex flex-col items-center max-w-lg">
              <Icon name="favorite" size={28} className="text-error mb-3" fill />
              <h3 className="font-serif text-2xl mb-2">Support TFT Clash</h3>
              <p className="text-sm text-on-surface-variant mb-6 max-w-sm">
                Running tournaments costs time and money. If you enjoy competing here, consider a one-time donation to help keep the lights on.
              </p>
              <a
                href={getDonateUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-8 py-3 rounded-full font-label font-bold uppercase tracking-widest text-sm hover:bg-primary/20 transition-all"
              >
                <Icon name="volunteer_activism" size={18} />
                Donate via PayPal
              </a>
              <p className="text-[10px] text-on-surface-variant/40 mt-3 font-mono uppercase tracking-widest">
                Every contribution helps
              </p>
            </Panel>
          </section>
        ) : null}

        {/* Feature Comparison Table */}
        <section className="mt-24">
          <h2 className="font-serif text-4xl mb-12">The Specification</h2>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 pb-4 border-b border-outline-variant/20 font-label uppercase tracking-[0.15em] text-[10px] text-on-surface-variant">
                <div>Feature</div>
                <div className="text-center">Free</div>
                <div className="text-center text-primary">Pro</div>
                <div className="text-center">Scrim</div>
                <div className="text-center text-primary font-bold">Bundle</div>
                <div className="text-center text-tertiary">Host</div>
              </div>

              {/* Rows */}
              <div className="space-y-1 py-4">
                {COMPARISON_ROWS.map(function(row, i) {
                  var isAlt = i % 2 === 0
                  return (
                    <div
                      key={row.label}
                      className={'grid grid-cols-6 gap-2 items-center py-2.5 px-3 rounded' + (isAlt ? ' bg-surface-container-low' : '')}
                    >
                      <div className="font-body text-sm">{row.label}</div>
                      {row.type === 'bool' ? (
                        <>
                          <BoolCell value={row.free} />
                          <BoolCell value={row.pro} />
                          <BoolCell value={row.scrim} />
                          <BoolCell value={row.bundle} />
                          <BoolCell value={row.host} />
                        </>
                      ) : (
                        <>
                          <div className="font-mono text-center text-xs opacity-60">{row.free}</div>
                          <div className="font-mono text-center text-xs text-primary">{row.pro}</div>
                          <div className="font-mono text-center text-xs opacity-60">{row.scrim}</div>
                          <div className="font-mono text-center text-xs text-primary font-bold">{row.bundle}</div>
                          <div className="font-mono text-center text-xs text-tertiary">{row.host}</div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h4 className="font-label uppercase tracking-widest text-xs text-primary mb-2">
              Inquiries
            </h4>
            <h2 className="font-serif text-4xl mb-6">Frequently Asked Questions</h2>
            <p className="text-on-surface-variant text-sm">
              Still unsure? Our support team is active on Discord.
            </p>
            <div className="mt-8 flex gap-4 flex-wrap">
              <a
                href="mailto:support@tftclash.com"
                className="inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-widest transition-all duration-300 py-3 px-6 text-sm min-h-[44px] bg-surface-container-high text-on-surface border border-outline-variant/15 hover:bg-surface-container-highest"
              >
                Email Support
              </a>
              <Btn variant="tertiary" size="md" onClick={handleHostApplyClick}>
                Host Application
              </Btn>
              {getDonateUrl() ? (
                <a
                  href={getDonateUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-error/10 border border-error/30 text-error px-6 py-3 rounded-full text-sm font-label font-bold uppercase tracking-widest hover:bg-error/20 transition-colors inline-flex items-center gap-2"
                >
                  <Icon name="favorite" size={16} fill />
                  Donate
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map(function(item) {
              return (
                <Panel key={item.q} padding="tight">
                  <h5 className="font-bold mb-2 text-sm">{item.q}</h5>
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
