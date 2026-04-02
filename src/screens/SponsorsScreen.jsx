import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

/* ─── DATA ─── */

var TIERS = [
  {
    name: 'Associate',
    tag: 'Entry Level',
    featured: false,
    color: 'tertiary',
    icon: 'handshake',
    items: [
      'Logo on platform homepage',
      'Discount or affiliate code for all players',
      'Monthly Discord shoutout',
      'Listed as Official Partner',
      'Affiliate link in platform footer',
    ],
  },
  {
    name: 'Official Sponsor',
    tag: 'Recommended',
    featured: true,
    color: 'primary',
    icon: 'verified',
    items: [
      'Everything in Associate',
      'Logo on bracket screen during live tournaments',
      'Named award in Hall of Fame',
      'Featured in every season recap post',
      'Product as Season Grand Prize',
      'Co-branded social content',
      'Overlay placement during Twitch broadcasts',
    ],
  },
  {
    name: 'Title Partner',
    tag: 'Premium',
    featured: false,
    color: 'tertiary',
    icon: 'diamond',
    items: [
      'Everything in Official Sponsor',
      'Full season named after your brand',
      'Exclusive Hall of Fame category',
      'Prizes across all placement tiers',
      'First right of refusal each new season',
      'Custom activation designed together',
      'Priority placement across all channels',
    ],
  },
]

var DELIVERABLES = [
  {
    icon: 'emoji_events',
    title: 'Named Tournament or Season',
    desc: 'Your brand names our Season Finals or Grand Prix event. Every announcement, results post, bracket screen, and Hall of Fame entry carries your name for the full cycle.',
  },
  {
    icon: 'display_settings',
    title: 'Platform Logo Placement',
    desc: 'Logo on the TFT Clash homepage, live bracket screen during tournaments, and Hall of Fame page. Seen by every active player, every session.',
  },
  {
    icon: 'campaign',
    title: 'Discord and Social Announcements',
    desc: 'Sponsor featured in every tournament kick-off, results post, and season recap across Discord, Twitter/X, Twitch, and YouTube.',
  },
  {
    icon: 'military_tech',
    title: 'Named Award in Hall of Fame',
    desc: 'A permanent Hall of Fame category bearing your brand name. Evergreen visibility every season alongside the best performances in platform history.',
  },
  {
    icon: 'redeem',
    title: 'Product as Prize',
    desc: 'Your product as Grand Prize, Finalist Prize, or MVP Award. Peak brand association with winning, photographed and shared at the moment of highest community engagement.',
  },
  {
    icon: 'link',
    title: 'Affiliate and Discount Code',
    desc: 'Your code embedded in player onboarding, the platform footer, and our Discord resources channel. Direct conversion from a high-intent audience actively spending on gaming gear.',
  },
  {
    icon: 'videocam',
    title: 'Twitch Broadcast Integration',
    desc: 'Sponsor branding in tournament livestreams via overlay and verbal mention. Live competitive content with a real audience watching results unfold in real time.',
  },
]

var PLATFORM_FEATURES = [
  { icon: 'account_tree', title: 'Multi-Lobby Bracket System', body: 'Structured bracketed tournaments with seeding, live score tracking, and automatic progression through each stage.' },
  { icon: 'gavel', title: 'Dispute System', body: 'Proof-based score submission with a live moderation and dispute resolution layer. Competitive integrity enforced, not assumed.' },
  { icon: 'stairs', title: '20-Tier Achievement Ladder', body: 'Season-long system that tracks and rewards consistent performance at every skill level in the community.' },
  { icon: 'workspace_premium', title: 'Hall of Fame', body: 'Seven permanent record categories. Sponsor names placed here exist on the platform indefinitely.' },
  { icon: 'leaderboard', title: 'Seasonal Leaderboards', body: 'Live ranked standings updated every tournament cycle with full historical archive.' },
  { icon: 'groups', title: 'Role Hierarchy', body: 'Admin, Mod, Lobby Host, Player structure mirrors the operational model of professional leagues.' },
]

var STATS = [
  { value: '100%', label: 'Active Competitors', icon: 'person' },
  { value: '20', label: 'Achievement Tiers', icon: 'stairs' },
  { value: '7', label: 'Hall of Fame Records', icon: 'workspace_premium' },
  { value: 'Global', label: 'Player Reach', icon: 'public' },
]

var WHY_US = [
  {
    icon: 'person',
    title: 'Real Players, Zero Lurkers',
    body: 'Every person on TFT Clash actively competes, submits scores, earns achievements, and climbs leaderboards. This is the highest-intent gaming audience you can reach.',
  },
  {
    icon: 'layers',
    title: 'Full-Stack Esports Infrastructure',
    body: 'Not a Discord server with a bracket. A production-grade platform with multi-lobby tournaments, a dispute system, a 20-tier achievement ladder, a Hall of Fame, and seasonal leaderboards.',
  },
  {
    icon: 'autorenew',
    title: 'Recurring Seasonal Visibility',
    body: 'Structured seasons run every TFT set cycle. New season, new champion, new sponsor visibility. Your placement compounds in value over time.',
  },
  {
    icon: 'storefront',
    title: 'Ground-Floor Timing',
    body: 'TFT is in its strongest competitive moment. EWC 2026 hit $500K. The brands that show up early are the ones players remember when they recommend gear to friends.',
  },
]

var WHAT_YOU_RECEIVE = [
  'Brand inside a structured competitive platform with real infrastructure, not just a banner',
  'Naming rights on events and Hall of Fame categories that persist permanently',
  'Affiliate code exposure to players actively buying gaming gear and peripherals',
  'Association with winning: your product photographed and shared at peak engagement',
  'Recurring seasonal visibility that compounds in value every new cycle',
  'Access to a focused global demographic impossible to target efficiently through traditional ads',
]

var WHAT_WE_GAIN = [
  'A legitimate named prize that elevates the perceived quality of our tournament circuit',
  'Brand credibility that signals to players this is a serious, accountable platform',
  'Content to create: unboxings, prize delivery, winner moments for organic promotion',
  'A partner name to feature in every outreach, growing our ability to attract further sponsors',
  'A long-term partner to grow with as the platform scales',
]

/* ─── COMPONENTS ─── */

function StatCard(props) {
  return (
    <div className="group flex flex-col items-center justify-center bg-surface-container rounded-xl p-6 border border-outline-variant hover:border-primary/40 transition-colors">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <Icon name={props.icon} className="text-primary text-lg" />
      </div>
      <span className="font-playfair text-4xl font-bold text-primary mb-1">{props.value}</span>
      <span className="font-barlow text-xs tracking-widest uppercase text-on-surface-variant">{props.label}</span>
    </div>
  )
}

function DeliverableCard(props) {
  return (
    <div className="flex gap-4 items-start bg-surface-container rounded-xl p-5 border border-outline-variant hover:border-primary/30 transition-colors">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
        <Icon name={props.icon} className="text-primary text-xl" />
      </div>
      <div>
        <p className="font-barlow text-sm tracking-widest uppercase text-on-surface font-semibold mb-1">{props.title}</p>
        <p className="text-on-surface-variant text-sm leading-relaxed">{props.desc}</p>
      </div>
    </div>
  )
}

function WhyCard(props) {
  return (
    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant hover:border-primary/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center mb-4">
        <Icon name={props.icon} className="text-primary text-xl" />
      </div>
      <p className="font-barlow text-sm tracking-widest uppercase text-primary font-semibold mb-2">{props.title}</p>
      <p className="text-on-surface-variant text-sm leading-relaxed">{props.body}</p>
    </div>
  )
}

function TierCard(props) {
  var tier = props.tier
  var isFeatured = tier.featured
  var borderClass = isFeatured ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'
  var headClass = isFeatured ? 'bg-primary' : 'bg-surface-container-high'
  var headTextClass = isFeatured ? 'text-on-primary' : 'text-on-surface'
  var headSubClass = isFeatured ? 'text-on-primary/60' : 'text-on-surface-variant'

  return (
    <div className={'rounded-xl border overflow-hidden flex flex-col ' + borderClass + (isFeatured ? ' scale-[1.02] shadow-lg shadow-primary/10' : '')}>
      <div className={'px-5 py-5 ' + headClass}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name={tier.icon} className={'text-lg ' + headTextClass} />
          <p className={'font-barlow text-base tracking-widest uppercase font-bold ' + headTextClass}>{tier.name}</p>
        </div>
        <p className={'font-barlow text-xs tracking-wider uppercase mt-1 ' + headSubClass}>{tier.tag}</p>
      </div>
      <div className="bg-surface-container p-5 flex-1">
        <ul className="space-y-3">
          {tier.items.map(function(item, i) {
            return (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant leading-snug">
                <Icon name="check" className="text-primary text-base shrink-0 mt-0.5" />
                {item}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function SectionHeader(props) {
  return (
    <div className={props.center ? 'text-center' : ''}>
      <p className="font-barlow text-xs tracking-widest uppercase text-primary mb-3">{props.tag}</p>
      <h2 className="font-playfair text-3xl font-bold text-on-surface mb-2">{props.title}</h2>
      {props.subtitle && (
        <p className={'text-on-surface-variant leading-relaxed ' + (props.center ? 'max-w-2xl mx-auto' : '')}>{props.subtitle}</p>
      )}
    </div>
  )
}

/* ─── MAIN ─── */

export default function SponsorsScreen() {
  var app = useApp()
  var _tab = useState(0)
  var activeTab = _tab[0]
  var setActiveTab = _tab[1]

  return (
    <PageLayout maxWidth="max-w-5xl">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl bg-surface-container border border-outline-variant mb-16">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-6 md:px-12 py-16 md:py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8">
            <Icon name="handshake" className="text-primary text-sm" />
            <span className="font-barlow text-xs tracking-widest uppercase text-primary font-semibold">Partnership Opportunities</span>
          </div>

          <h1 className="font-playfair text-4xl sm:text-5xl md:text-6xl font-bold text-on-surface mb-5 leading-tight">
            Put Your Brand Where<br />
            <span className="text-primary">Competitors Are Watching</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            TFT Clash is a purpose-built competitive tournament platform for serious Teamfight Tactics players.
            Real infrastructure. Real competition. A global audience that takes the game seriously.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:contact@tftclash.gg"
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl px-8 py-3.5 font-barlow tracking-widest uppercase text-sm font-semibold hover:opacity-90 transition-opacity no-underline"
            >
              <Icon name="mail" className="text-base" />
              Get In Touch
            </a>
            <a
              href="#tiers"
              className="inline-flex items-center justify-center gap-2 bg-surface-container-high text-on-surface rounded-xl px-8 py-3.5 font-barlow tracking-widest uppercase text-sm font-semibold border border-outline-variant hover:border-primary/40 transition-colors no-underline"
            >
              <Icon name="arrow_downward" className="text-base" />
              View Tiers
            </a>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="mb-16">
        <p className="font-barlow text-xs tracking-widest uppercase text-on-surface-variant text-center mb-6">Platform at a Glance</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map(function(s) {
            return <StatCard key={s.label} value={s.value} label={s.label} icon={s.icon} />
          })}
        </div>
      </div>

      {/* ── ABOUT ── */}
      <div className="mb-16">
        <SectionHeader tag="01 - Who We Are" title="What is TFT Clash?" />
        <div className="space-y-4 text-on-surface-variant leading-relaxed mt-5">
          <p>
            TFT Clash is a fully custom-built competitive tournament platform for the global Teamfight Tactics community.
            Not a Discord server with a spreadsheet bracket. A production-grade platform with the infrastructure of a real
            esports circuit: structured multi-lobby brackets, a proof-based scoring and dispute system, a 20-tier achievement
            ladder, a permanent Hall of Fame, a role hierarchy, and seasonal leaderboards.
          </p>
          <p>
            Every feature was deliberately built to create a legitimate competitive environment at the grassroots level.
            The layer that sits between casual ranked play and the professional circuit. Players who compete here are serious
            about the game, serious about improving, and serious about their setups.
          </p>
        </div>
        <div className="mt-6 p-5 rounded-xl bg-primary-container/30 border border-primary/20">
          <p className="font-barlow text-xs tracking-widest uppercase text-primary mb-2">Why Now</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            TFT is in its strongest competitive moment. The Esports World Cup 2026 TFT prize pool reached $500,000.
            The Las Vegas Open returns end of 2026 as the biggest open-bracket event on the global TFT calendar.
            TFT Clash is building the grassroots foundation of this growing scene, and the brands that show up early
            are the ones players remember.
          </p>
        </div>
      </div>

      {/* ── WHY US ── */}
      <div className="mb-16">
        <SectionHeader tag="02 - Why Partner With Us" title="What Makes This Different" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {WHY_US.map(function(w) {
            return <WhyCard key={w.title} icon={w.icon} title={w.title} body={w.body} />
          })}
        </div>
      </div>

      {/* ── MUTUAL EXPOSURE ── */}
      <div className="mb-16">
        <SectionHeader
          tag="03 - Mutual Exposure"
          title="What Both Sides Gain"
          subtitle="This works because the interests are genuinely aligned, not a one-sided sponsorship ask."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* What You Receive */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant">
              <Icon name="arrow_downward" className="text-tertiary text-sm" />
              <p className="font-barlow text-xs tracking-widest uppercase text-tertiary font-semibold">
                What You Receive
              </p>
            </div>
            <ul className="space-y-3">
              {WHAT_YOU_RECEIVE.map(function(item, i) {
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant leading-snug">
                    <Icon name="check" className="text-tertiary text-base shrink-0 mt-0.5" />
                    {item}
                  </li>
                )
              })}
            </ul>
          </div>
          {/* What We Gain */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant">
              <Icon name="arrow_upward" className="text-primary text-sm" />
              <p className="font-barlow text-xs tracking-widest uppercase text-primary font-semibold">
                What We Gain
              </p>
            </div>
            <ul className="space-y-3">
              {WHAT_WE_GAIN.map(function(item, i) {
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant leading-snug">
                    <Icon name="check" className="text-primary text-base shrink-0 mt-0.5" />
                    {item}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* ── DELIVERABLES ── */}
      <div className="mb-16">
        <SectionHeader
          tag="04 - Deliverables"
          title="What Sponsors Receive"
          subtitle="Every partnership is tailored. These are the core activations available at all tiers."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {DELIVERABLES.map(function(d) {
            return <DeliverableCard key={d.title} icon={d.icon} title={d.title} desc={d.desc} />
          })}
        </div>
      </div>

      {/* ── TIERS ── */}
      <div id="tiers" className="mb-16 scroll-mt-24">
        <SectionHeader
          tag="05 - Partnership Tiers"
          title="How We Work Together"
          subtitle="Three entry points, fully flexible. We build the partnership around what works for both sides. Every tier includes a personal point of contact before any agreement is signed."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 items-start">
          {TIERS.map(function(tier) {
            return <TierCard key={tier.name} tier={tier} />
          })}
        </div>
      </div>

      {/* ── PLATFORM FEATURES ── */}
      <div className="mb-16">
        <SectionHeader tag="06 - Platform" title="What is Inside TFT Clash" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {PLATFORM_FEATURES.map(function(f) {
            return (
              <div key={f.title} className="flex gap-4 items-start bg-surface-container rounded-xl p-5 border border-outline-variant border-l-2 border-l-primary hover:border-l-primary transition-colors">
                <Icon name={f.icon} className="text-primary text-xl shrink-0 mt-0.5" />
                <div>
                  <p className="font-barlow text-xs tracking-widest uppercase text-on-surface font-semibold mb-1">{f.title}</p>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{f.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── POWERED BY ── */}
      <div className="mb-16">
        <div className="rounded-xl bg-surface-container border border-outline-variant p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0">
            <img src="/sl-logo-alt-purple.png" alt="Sebastian Lives" className="w-24 h-auto opacity-80" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="font-barlow text-xs tracking-widest uppercase text-primary mb-2">Powered By</p>
            <p className="font-playfair text-xl font-bold text-on-surface mb-2">Sebastian Lives Entertainment</p>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              TFT Clash is operated by Sebastian Lives, a gaming and esports organization focused on building
              competitive communities from the ground up. Our infrastructure, branding, and tournament operations
              are backed by years of experience in the competitive gaming space.
            </p>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="rounded-2xl bg-primary-container/40 border border-primary/20 p-8 md:p-12 text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-5">
          <Icon name="handshake" className="text-on-primary text-2xl" />
        </div>
        <h2 className="font-playfair text-3xl font-bold text-on-surface mb-3">Ready to Partner?</h2>
        <p className="text-on-surface-variant max-w-lg mx-auto mb-8 leading-relaxed">
          The grassroots tier is where brand loyalty is built. Players remember who showed up before they went pro.
          Let us build something that works for both of us.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:contact@tftclash.gg"
            className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl px-8 py-3.5 font-barlow tracking-widest uppercase text-sm font-semibold hover:opacity-90 transition-opacity no-underline"
          >
            <Icon name="mail" className="text-base" />
            Email Us
          </a>
          <a
            href="https://twitter.com/tftclash"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface rounded-xl px-8 py-3.5 font-barlow tracking-widest uppercase text-sm font-semibold border border-outline-variant hover:border-primary/40 transition-colors no-underline"
          >
            <Icon name="open_in_new" className="text-base" />
            Twitter / X
          </a>
        </div>
        <p className="text-on-surface-variant text-xs mt-6 font-barlow tracking-wider">
          We respond to all partnership enquiries within 48 hours.
        </p>
      </div>

    </PageLayout>
  )
}
