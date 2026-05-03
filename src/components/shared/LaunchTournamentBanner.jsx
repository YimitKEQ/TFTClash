import Icon from '../ui/Icon.jsx'

// 1200x630 (Twitter / OG / Discord card aspect) launch-tournament banner
// in the TFT Clash neon palette. Drop into a route to render in-app, or
// screenshot the rendered DOM for social posts. Fully prop-driven so the
// prize copy can be tuned per tournament.
//
// Props:
//   title          - main headline (default: 'LAUNCH CLASH')
//   subtitle       - editorial line below title (default: 'The First Custom Tournament')
//   dateText       - rendered as the date row (default: 'Coming Soon')
//   regionText     - rendered as the region row (default: 'EU + NA')
//   prizes         - array of 3 prize lines for top3 (default below)
//   tagline        - small footer tagline (default below)
//   ctaText        - call-to-action button copy (default: 'Register Free')
//   sizeClass      - tailwind sizing override; default fixed 1200x630
export default function LaunchTournamentBanner(props) {
  var title = props.title || 'LAUNCH CLASH'
  var subtitle = props.subtitle || 'The First Custom Tournament'
  var dateText = props.dateText || 'COMING SOON'
  var regionText = props.regionText || 'EU + NA'
  var ctaText = props.ctaText || 'Register Free at tftclash.com'
  var tagline = props.tagline || 'Prize pool scales with the field. Every player makes the pot bigger.'
  var prizes = Array.isArray(props.prizes) && props.prizes.length === 3 ? props.prizes : [
    { medal: '1st', perk: 'Pro Membership (1 yr)', cash: '50% of pool', tone: 'gold' },
    { medal: '2nd', perk: 'Pro Membership (6 mo)', cash: '30% of pool', tone: 'silver' },
    { medal: '3rd', perk: 'Pro Membership (3 mo)', cash: '20% of pool', tone: 'bronze' }
  ]

  var sizeClass = props.sizeClass || 'w-[1200px] h-[630px]'

  // Medal token map
  var medalColors = {
    gold:   { bg: 'bg-[#e8a838]',   text: 'text-[#1a0f00]', glow: '#ffc66b' },
    silver: { bg: 'bg-[#c0c0c0]',   text: 'text-[#0e0d15]', glow: '#e6e6e6' },
    bronze: { bg: 'bg-[#cd7f32]',   text: 'text-[#1a0f00]', glow: '#e89858' }
  }

  return (
    <div
      className={sizeClass + ' relative overflow-hidden bg-surface select-none'}
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 20%, rgba(255,198,107,0.16) 0%, transparent 42%),' +
          'radial-gradient(circle at 82% 78%, rgba(217,185,255,0.14) 0%, transparent 46%),' +
          'radial-gradient(circle at 60% 50%, rgba(103,226,217,0.10) 0%, transparent 55%),' +
          'linear-gradient(135deg, #0e0d15 0%, #13131a 50%, #0e0d15 100%)'
      }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,198,107,0.4) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,198,107,0.4) 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }}
      />

      {/* Diagonal scan lines */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(217,185,255,0.5) 8px, rgba(217,185,255,0.5) 9px)'
        }}
      />

      {/* Accent corner glows */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full blur-[120px] opacity-40"
           style={{ background: 'radial-gradient(circle, #ffc66b 0%, transparent 70%)' }} />
      <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full blur-[120px] opacity-30"
           style={{ background: 'radial-gradient(circle, #d9b9ff 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 right-1/4 w-[280px] h-[280px] rounded-full blur-[100px] opacity-20"
           style={{ background: 'radial-gradient(circle, #67e2d9 0%, transparent 70%)' }} />

      {/* Diagonal neon stripes (top-right to bottom-left) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 630" preserveAspectRatio="none">
        <line x1="1100" y1="-50" x2="500" y2="700" stroke="#ffc66b" strokeWidth="1.5" opacity="0.35" />
        <line x1="1180" y1="-50" x2="580" y2="700" stroke="#d9b9ff" strokeWidth="1" opacity="0.25" />
        <line x1="1260" y1="-50" x2="660" y2="700" stroke="#67e2d9" strokeWidth="0.75" opacity="0.2" />
      </svg>

      {/* Content layer */}
      <div className="relative z-10 h-full flex flex-col justify-between p-14">
        {/* Top row: brand + meta */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" style={{ boxShadow: '0 0 12px #67e2d9' }} />
              <span className="font-label text-[12px] font-bold tracking-[0.4em] uppercase text-tertiary">TFT CLASH</span>
            </div>
            <span className="font-label text-[11px] font-bold tracking-[0.3em] uppercase text-secondary">/ LAUNCH EVENT</span>
          </div>

          <div className="text-right space-y-1">
            <div className="font-mono text-[12px] tracking-wider text-on-surface-variant uppercase">{regionText}</div>
            <div className="font-display text-[28px] tracking-tight text-primary leading-none uppercase"
                 style={{ textShadow: '0 0 20px rgba(255,198,107,0.5)' }}>
              {dateText}
            </div>
          </div>
        </div>

        {/* Center: hero title */}
        <div className="flex-1 flex flex-col justify-center -mt-2">
          <div className="font-label text-[14px] font-bold tracking-[0.5em] uppercase text-secondary mb-4">
            {subtitle}
          </div>
          <h1
            className="font-display uppercase leading-[0.9] tracking-tighter text-on-background"
            style={{
              fontSize: 'clamp(80px, 11vw, 168px)',
              textShadow: '0 0 40px rgba(255,198,107,0.45), 0 0 80px rgba(217,185,255,0.25)'
            }}
          >
            <span className="text-primary">{title.split(' ')[0]}</span>
            {title.split(' ').length > 1 && (
              <>
                {' '}
                <span className="text-on-background">{title.split(' ').slice(1).join(' ')}</span>
              </>
            )}
          </h1>

          {/* Accent rule */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 max-w-[120px]"
                 style={{ background: 'linear-gradient(90deg, transparent, #ffc66b, transparent)' }} />
            <Icon name="emoji_events" size={20} className="text-primary" />
            <span className="font-label text-[12px] font-bold tracking-[0.3em] uppercase text-on-surface-variant">
              Top 3 Prize Tiers
            </span>
            <Icon name="emoji_events" size={20} className="text-primary" />
            <div className="h-px flex-1 max-w-[120px]"
                 style={{ background: 'linear-gradient(90deg, transparent, #ffc66b, transparent)' }} />
          </div>
        </div>

        {/* Prize tiles */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {prizes.map(function(p, i) {
            var c = medalColors[p.tone] || medalColors.gold
            return (
              <div key={i}
                   className="relative bg-surface-container/80 backdrop-blur-sm border border-outline-variant/20 rounded-xl p-5 overflow-hidden"
                   style={{ boxShadow: '0 0 24px ' + c.glow + '22, inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: c.glow, boxShadow: '0 0 12px ' + c.glow }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + c.bg + ' ' + c.text}
                       style={{ boxShadow: '0 0 16px ' + c.glow + '66' }}>
                    <Icon name={i === 0 ? 'workspace_premium' : i === 1 ? 'military_tech' : 'verified'} size={22} />
                  </div>
                  <span className="font-display text-[28px] tracking-tight uppercase"
                        style={{ color: c.glow, textShadow: '0 0 12px ' + c.glow + '88' }}>
                    {p.medal}
                  </span>
                </div>
                <div className="font-display text-on-background text-[17px] leading-tight mb-1 uppercase tracking-tight">
                  {p.perk}
                </div>
                <div className="font-mono text-[12px] text-tertiary tracking-wider">
                  + {p.cash}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom row: tagline + CTA */}
        <div className="flex items-end justify-between gap-6">
          <p className="font-body text-[14px] text-on-surface-variant max-w-[640px] leading-relaxed">
            {tagline}
          </p>
          <div className="flex flex-col items-end">
            <div className="bg-primary text-on-primary font-label font-bold text-[15px] tracking-[0.2em] uppercase px-7 py-4 rounded-lg"
                 style={{ boxShadow: '0 0 32px rgba(255,198,107,0.6), 0 8px 24px rgba(0,0,0,0.4)' }}>
              {ctaText}
            </div>
            <div className="font-mono text-[10px] text-on-surface-variant/50 mt-2 tracking-wider uppercase">
              Free to compete - always
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
