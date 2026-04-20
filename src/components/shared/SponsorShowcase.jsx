import { useApp } from '../../context/AppContext'

function SponsorLogo(props) {
  var sponsor = props.sponsor
  var size = props.size
  var heightClass = size === 'lg' ? 'h-20' : size === 'md' ? 'h-12' : 'h-8'
  var href = sponsor.url || sponsor.link_url || '#'
  var initial = (sponsor.name || '?').charAt(0).toUpperCase()

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="flex flex-col items-center gap-2 group no-underline"
      title={sponsor.name}
    >
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name + ' logo'}
          loading="lazy"
          decoding="async"
          className={heightClass + ' object-contain transition-transform duration-200 group-hover:scale-105'}
        />
      ) : (
        <div className={heightClass + ' aspect-square rounded-lg bg-surface-container-high border border-outline-variant/20 flex items-center justify-center'}>
          <span className="font-headline text-2xl font-bold text-primary">{initial}</span>
        </div>
      )}
      {sponsor.tagline ? (
        <span className="font-body text-xs text-on-surface-variant max-w-[200px] text-center">
          {sponsor.tagline}
        </span>
      ) : null}
    </a>
  )
}

export default function SponsorShowcase(props) {
  var placement = props.placement || 'homepage'
  var variant = props.variant || 'strip'
  var eyebrow = props.eyebrow
  var className = props.className || ''

  var ctx = useApp()
  var orgSponsors = ctx.orgSponsors || []

  var filtered = orgSponsors.filter(function(s) {
    if (s.status !== 'active') return false
    if (!s.placements || !Array.isArray(s.placements)) return true
    return s.placements.indexOf(placement) > -1
  })

  if (filtered.length === 0) return null

  var defaultEyebrow = placement === 'homepage' ? 'Partnered With'
    : placement === 'leaderboard' ? 'Leaderboard Powered By'
    : placement === 'dashboard' ? 'This week brought to you by'
    : placement === 'bracket' ? 'Bracket Presented By'
    : 'Our Partners'

  var finalEyebrow = eyebrow || defaultEyebrow

  if (variant === 'featured') {
    var first = filtered[0]
    return (
      <div className={'py-8 ' + className}>
        <div className="text-center mb-4">
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {finalEyebrow}
          </span>
        </div>
        <div className="flex justify-center">
          <SponsorLogo sponsor={first} size="lg" />
        </div>
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className={'py-8 ' + className}>
        <div className="text-center mb-6">
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {finalEyebrow}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 items-center">
          {filtered.map(function(sp) {
            return <SponsorLogo key={sp.id || sp.name} sponsor={sp} size="md" />
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={'py-6 border-y border-outline-variant/20 ' + className}>
      <div className="text-center mb-3">
        <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {finalEyebrow}
        </span>
      </div>
      <div className="flex items-center justify-center gap-8 flex-wrap px-4">
        {filtered.map(function(sp) {
          return <SponsorLogo key={sp.id || sp.name} sponsor={sp} size="md" />
        })}
      </div>
    </div>
  )
}
