import { useState } from 'react'
import { Icon } from '../../components/ui'
import { thumbUrl, fullUrl, domainColor } from '../../lib/riftbound/cards.js'

// Small colored dot for a domain, used everywhere a card's colors appear.
export function DomainDot(props) {
  var name = props.name
  var size = props.size || 10
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: domainColor(name) }}
      title={name}
      aria-label={name}
    />
  )
}

// Energy cost chip (the number cost) and might chip (combat strength).
export function StatChip(props) {
  var kind = props.kind
  var value = props.value
  if (value === null || value === undefined) return null
  var cls = kind === 'might'
    ? 'bg-error/15 text-error border-error/30'
    : kind === 'power'
      ? 'bg-secondary/15 text-secondary border-secondary/30'
      : 'bg-primary/15 text-primary border-primary/30'
  var icon = kind === 'might' ? 'swords' : kind === 'power' ? 'diamond' : 'bolt'
  var label = kind === 'might' ? 'Might' : kind === 'power' ? 'Power' : 'Energy'
  return (
    <span className={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[11px] font-bold ' + cls} title={label}>
      <Icon name={icon} size={11} aria-hidden="true" />
      {value}
    </span>
  )
}

// A card thumbnail that lazy-loads from Riot's CDN and opens the full-size
// viewer on click. Renders a name-plate fallback while loading or on error.
export function CardThumb(props) {
  var card = props.card
  var onOpen = props.onOpen
  var width = props.width || 320
  var _err = useState(false)
  var err = _err[0]
  var setErr = _err[1]
  if (!card) return null
  return (
    <button
      type="button"
      onClick={function() { if (onOpen) onOpen(card) }}
      className="group relative block w-full rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container-low cursor-pointer transition-transform hover:scale-[1.03] hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={{ aspectRatio: '744 / 1039' }}
      aria-label={'View ' + card.n}
    >
      {!err ? (
        <img
          src={thumbUrl(card, width)}
          alt={card.n}
          loading="lazy"
          onError={function() { setErr(true) }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
          <Icon name="playing_cards" size={22} className="text-on-surface-variant/40" />
          <span className="text-[10px] text-on-surface-variant/60 leading-tight">{card.n}</span>
        </span>
      )}
    </button>
  )
}

// Fullscreen card viewer. Shows the real card at readable size plus the
// parsed stats underneath for accessibility / small screens.
export function CardModal(props) {
  var card = props.card
  var onClose = props.onClose
  if (!card) return null
  return (
    <div
      className="fixed inset-0 z-[1004] bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={card.n}
    >
      <div className="max-w-sm w-full" onClick={function(e) { e.stopPropagation() }}>
        <img
          src={fullUrl(card)}
          alt={card.n}
          className="w-full rounded-xl shadow-2xl"
          style={{ aspectRatio: '744 / 1039' }}
        />
        <div className="mt-3 bg-surface-container-low border border-outline-variant/15 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {(card.d || []).map(function(d) { return <DomainDot key={d} name={d} size={9} /> })}
              <span className="font-display text-sm text-on-surface truncate">{card.n}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <StatChip kind="energy" value={card.e} />
              <StatChip kind="power" value={card.p} />
              <StatChip kind="might" value={card.m} />
            </div>
          </div>
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/50 mb-1">
            {card.t + (card.st ? ' - ' + card.st : '') + ' - ' + card.r}
          </div>
          {card.x && <p className="text-xs text-on-surface-variant/80 leading-relaxed">{card.x}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2.5 bg-surface-container-high text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// Inline example card reference for the Learn page: small thumb + caption.
export function ExampleCard(props) {
  var card = props.card
  var caption = props.caption
  var onOpen = props.onOpen
  if (!card) return null
  return (
    <figure className="w-32 sm:w-36 flex-shrink-0 m-0">
      <CardThumb card={card} onOpen={onOpen} width={220} />
      {caption && <figcaption className="text-[10px] text-on-surface-variant/50 mt-1.5 leading-snug text-center">{caption}</figcaption>}
    </figure>
  )
}
