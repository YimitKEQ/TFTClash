import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/ui'
import { loadCards } from '../../lib/riftbound/cards.js'
import { DOMAINS } from '../../lib/riftbound/content.js'
import { CardThumb, CardModal, DomainDot } from './CardBits.jsx'

// Pick a few showcase cards for a domain: its Rune card first, then a Legend
// and a couple of iconic (Epic/Rare) mono-domain cards.
function showcaseFor(cards, domainName) {
  var inDomain = cards.filter(function(c) {
    return (c.d || []).length === 1 && c.d[0] === domainName
  })
  var rune = inDomain.find(function(c) { return c.t === 'Rune' })
  var legend = cards.find(function(c) {
    return c.t === 'Legend' && (c.d || []).indexOf(domainName) !== -1
  })
  var picks = inDomain
    .filter(function(c) { return c.t === 'Unit' && (c.r === 'Epic' || c.r === 'Rare') })
    .slice(0, 2)
  var out = []
  if (rune) out.push(rune)
  if (legend) out.push(legend)
  picks.forEach(function(c) { if (out.length < 4) out.push(c) })
  return out
}

export default function DomainsSection() {
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    return function() { alive = false }
  }, [])

  var showcases = useMemo(function() {
    if (!cards) return {}
    var out = {}
    DOMAINS.forEach(function(d) { out[d.name] = showcaseFor(cards, d.name) })
    return out
  }, [cards])

  return (
    <div className="space-y-6">
      <p className="text-sm text-on-surface-variant/70 max-w-2xl">
        Every deck is built around a Legend, and every Legend gives you access to two of the six Domains. A Domain is a playstyle as much as a color: it decides what your Rune deck looks like and what kinds of tricks your deck can pull. The Rune card shown first for each Domain is the actual resource card you shuffle 12 of into your Rune deck.
      </p>

      {DOMAINS.map(function(d) {
        var picks = (showcases[d.name] || [])
        return (
          <Panel key={d.id} padding="spacious" className="relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: d.color }} aria-hidden="true" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <DomainDot name={d.name} size={14} />
                  <h3 className="font-display text-xl text-on-surface">{d.name}</h3>
                  <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/50">{d.identity}</span>
                </div>
                <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-xl mb-3">{d.desc}</p>
                {d.playIf && (
                  <p className="text-xs text-on-surface-variant/55 leading-relaxed max-w-xl">
                    <span className="font-label uppercase tracking-widest text-[10px]" style={{ color: d.color }}>Play this if </span>
                    {d.playIf}
                  </p>
                )}
              </div>
              <div className="flex gap-2.5 flex-wrap lg:flex-nowrap">
                {!cards
                  ? [0, 1, 2].map(function(k) {
                      return <div key={k} className="w-24 sm:w-28 rounded-lg bg-surface-container/60 animate-pulse" style={{ aspectRatio: '744 / 1039' }} />
                    })
                  : picks.map(function(c) {
                      return (
                        <div key={c.id} className="w-24 sm:w-28">
                          <CardThumb card={c} onOpen={setOpen} width={220} />
                        </div>
                      )
                    })}
              </div>
            </div>
          </Panel>
        )
      })}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
