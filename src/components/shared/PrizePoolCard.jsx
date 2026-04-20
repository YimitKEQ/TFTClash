import Icon from '../ui/Icon.jsx'
import { medalForPlacement, computeCashPool, formatPrizeLabel, currencySymbol } from '../../lib/prizes.js'

// Presents a tournament prize pool with medal tiers, optional images,
// optional sponsor logos, and a computed cash pool header.
// Props:
//   prizes: Array of prize objects (see lib/prizes.js for shape)
//   sponsors: Array of sponsor objects from context (optional)
//   compact: boolean - when true, renders a denser layout for sidebars
export default function PrizePoolCard(props) {
  var prizes = props.prizes
  var sponsors = props.sponsors
  var compact = props.compact
  if (!Array.isArray(prizes) || prizes.length === 0) return null
  var cash = computeCashPool(prizes)
  var sorted = [].concat(prizes).sort(function(a, b) { return (a.placement || 9) - (b.placement || 9) })
  var sponsorById = {}
  ;(sponsors || []).forEach(function(s) { if (s && s.id) sponsorById[s.id] = s })

  return (
    <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-2">
        <Icon name="redeem" size={16} className="text-primary" />
        <span className="font-label font-bold text-xs tracking-widest uppercase text-on-surface">Prize Pool</span>
        {cash && (
          <span className="ml-auto text-[11px] font-mono font-bold text-tertiary">
            Total: {currencySymbol(cash.currency)}{cash.total.toLocaleString()}
          </span>
        )}
      </div>
      <ul className="divide-y divide-outline-variant/10">
        {sorted.map(function(p, idx) {
          var medal = medalForPlacement(p.placement)
          var sponsor = p.sponsor_id ? sponsorById[p.sponsor_id] : null
          var label = formatPrizeLabel(p) || p.prize || ''
          return (
            <li key={idx} className="flex items-center gap-3 px-4 py-2.5">
              <span className={'inline-flex items-center justify-center w-9 h-9 rounded-lg border flex-shrink-0 ' + medal.tone}>
                <Icon name={medal.icon} size={16} />
              </span>
              {p.image ? (
                <img src={p.image} alt={medal.label + ' prize'} loading="lazy"
                  className={(compact ? 'w-8 h-8' : 'w-10 h-10') + ' rounded object-cover border border-outline-variant/20 flex-shrink-0'} />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{medal.label}</span>
                  {p.type && p.type !== 'other' && (
                    <span className="text-[9px] font-label uppercase tracking-wider px-1.5 py-px rounded bg-on-surface/5 text-on-surface-variant">{p.type}</span>
                  )}
                </div>
                <div className="font-display text-sm text-on-surface truncate">{label || 'Pride only'}</div>
                {p.eligibility && (
                  <div className="text-[10px] text-on-surface-variant/60">For: {p.eligibility}</div>
                )}
              </div>
              {sponsor && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {sponsor.logo_url ? (
                    <img src={sponsor.logo_url} alt={sponsor.name} className="h-5 w-auto max-w-[48px] object-contain" loading="lazy" />
                  ) : null}
                  <span className="text-[10px] text-on-surface-variant/70 font-label uppercase tracking-wider">{sponsor.name}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
