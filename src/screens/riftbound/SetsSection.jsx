import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/ui'
import { loadCards, findByName } from '../../lib/riftbound/cards.js'
import { SETS } from '../../lib/riftbound/content.js'
import { CardThumb, CardModal } from './CardBits.jsx'

export default function SetsSection() {
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

  var counts = useMemo(function() {
    if (!cards) return {}
    var out = {}
    cards.forEach(function(c) { out[c.s] = (out[c.s] || 0) + 1 })
    return out
  }, [cards])

  var showcases = useMemo(function() {
    if (!cards) return {}
    var out = {}
    SETS.forEach(function(s) {
      out[s.code] = (s.showcase || [])
        .map(function(name) { return findByName(cards, name) })
        .filter(Boolean)
        .slice(0, 3)
    })
    return out
  }, [cards])

  return (
    <div className="space-y-6">
      <p className="text-sm text-on-surface-variant/70 max-w-2xl">
        Every Riftbound release so far, in order. Card counts come straight from the card database on this page.
      </p>

      <div className="relative pl-5 sm:pl-6">
        <span className="absolute left-1.5 sm:left-2 top-2 bottom-2 w-px bg-outline-variant/25" aria-hidden="true" />
        <div className="space-y-5">
          {SETS.map(function(s) {
            var picks = showcases[s.code] || []
            return (
              <div key={s.code} className="relative">
                <span className="absolute -left-5 sm:-left-6 top-6 w-3 h-3 rounded-full bg-primary border-2 border-surface translate-x-[-1px]" aria-hidden="true" />
                <Panel padding="spacious">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-display text-lg text-on-surface">{s.name}</h3>
                        <span className="font-mono text-[10px] text-on-surface-variant/40 bg-surface-container-low border border-outline-variant/15 rounded px-1.5 py-0.5">{s.code}</span>
                        <span className="font-label text-[10px] uppercase tracking-widest text-primary/70">{s.date}</span>
                        {counts[s.code] ? (
                          <span className="font-mono text-[10px] text-on-surface-variant/40">{counts[s.code] + ' cards'}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-on-surface-variant/75 leading-relaxed max-w-xl">{s.desc}</p>
                    </div>
                    {picks.length > 0 && (
                      <div className="flex gap-2.5">
                        {picks.map(function(c) {
                          return (
                            <div key={c.id} className="w-20 sm:w-24">
                              <CardThumb card={c} onOpen={setOpen} width={220} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
            )
          })}
        </div>
      </div>

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
