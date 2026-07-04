import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/ui'
import { loadCards, exampleForKeyword } from '../../lib/riftbound/cards.js'
import { KEYWORDS } from '../../lib/riftbound/content.js'
import { CardThumb, CardModal } from './CardBits.jsx'

function KeywordRow(props) {
  var kw = props.kw
  var card = props.card
  var onOpen = props.onOpen
  return (
    <div className="flex gap-4 rounded-xl border border-outline-variant/15 bg-surface-container/60 p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-display text-sm text-primary">{kw.name}</span>
          <span className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant/40">{kw.kind}</span>
        </div>
        <p className="text-xs text-on-surface-variant/80 leading-relaxed">{kw.def}</p>
        {kw.tip && (
          <p className="text-[11px] text-on-surface-variant/50 leading-relaxed mt-1.5">
            <Icon name="lightbulb" size={11} className="text-primary/60 inline-block align-[-1px] mr-1" aria-hidden="true" />
            {kw.tip}
          </p>
        )}
      </div>
      {card && (
        <div className="w-20 sm:w-24 flex-shrink-0">
          <CardThumb card={card} onOpen={onOpen} width={220} />
        </div>
      )}
    </div>
  )
}

export default function KeywordsSection() {
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]
  var _q = useState('')
  var q = _q[0]
  var setQ = _q[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    return function() { alive = false }
  }, [])

  var examples = useMemo(function() {
    if (!cards) return {}
    var out = {}
    KEYWORDS.forEach(function(kw) {
      out[kw.name] = exampleForKeyword(cards, kw.name)
    })
    return out
  }, [cards])

  var query = q.trim().toLowerCase()
  var filtered = query
    ? KEYWORDS.filter(function(kw) {
        return kw.name.toLowerCase().indexOf(query) !== -1 || kw.def.toLowerCase().indexOf(query) !== -1
      })
    : KEYWORDS

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant/70 max-w-2xl">
        Every keyword that appears on real Riftbound cards, in plain language. Each one is shown next to an actual card that uses it, so you can see the wording in context.
      </p>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">
          <Icon name="search" size={18} />
        </span>
        <input
          type="text"
          value={q}
          onChange={function(e) { setQ(e.target.value) }}
          placeholder="Search keywords..."
          aria-label="Search keywords"
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface text-sm py-3 pl-12 pr-4 placeholder:text-on-surface-variant/35 focus:outline-none focus:border-primary/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-on-surface-variant/60">{'No keywords match "' + q + '".'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(function(kw) {
            return <KeywordRow key={kw.name} kw={kw} card={examples[kw.name]} onOpen={setOpen} />
          })}
        </div>
      )}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
