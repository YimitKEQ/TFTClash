import { useEffect, useMemo, useState } from 'react'
import { Panel, Icon } from '../../components/ui'
import { loadCards, findByName } from '../../lib/riftbound/cards.js'
import { LEARN_CHAPTERS } from '../../lib/riftbound/content.js'
import { ExampleCard, CardModal } from './CardBits.jsx'

function Chapter(props) {
  var ch = props.chapter
  var cards = props.cards
  var onOpen = props.onOpen

  var examples = useMemo(function() {
    if (!cards || !ch.cards) return []
    return ch.cards
      .map(function(ref) {
        var card = findByName(cards, ref.name)
        return card ? { card: card, caption: ref.caption } : null
      })
      .filter(Boolean)
  }, [cards, ch])

  return (
    <Panel padding="spacious" id={'rb-' + ch.id}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon name={ch.icon} size={22} className="text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-primary/60 mb-0.5">{ch.num}</div>
          <h3 className="font-display text-xl text-on-surface mb-2">{ch.title}</h3>
          {ch.intro && <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-2xl">{ch.intro}</p>}
        </div>
      </div>

      {ch.points && ch.points.length > 0 && (
        <ul className="mt-4 space-y-2.5 sm:pl-[60px]">
          {ch.points.map(function(p, i) {
            return (
              <li key={i} className="flex gap-2.5 text-sm text-on-surface-variant/85 leading-relaxed max-w-2xl">
                <Icon name="arrow_right" size={16} className="text-primary/60 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {p.label && <span className="text-on-surface font-semibold">{p.label + ' '}</span>}
                  {p.text}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {ch.callout && (
        <div className="mt-4 sm:ml-[60px] max-w-2xl rounded-lg border border-tertiary/25 bg-tertiary/8 px-4 py-3">
          <p className="text-xs text-on-surface-variant/85 leading-relaxed">
            <Icon name="tips_and_updates" size={13} className="text-tertiary inline-block align-[-2px] mr-1.5" aria-hidden="true" />
            {ch.callout}
          </p>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-5 sm:ml-[60px] flex gap-3 overflow-x-auto pb-2">
          {examples.map(function(ex) {
            return <ExampleCard key={ex.card.id} card={ex.card} caption={ex.caption} onOpen={onOpen} />
          })}
        </div>
      )}
    </Panel>
  )
}

export default function LearnSection() {
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

  return (
    <div className="space-y-5">
      {/* Chapter jump nav */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {LEARN_CHAPTERS.map(function(ch) {
          return (
            <a
              key={ch.id}
              href={'#rb-' + ch.id}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/20 text-[11px] font-label uppercase tracking-widest text-on-surface/55 hover:text-on-surface hover:border-outline-variant/40 transition-colors no-underline"
            >
              <span className="font-mono text-primary/60 normal-case">{ch.num}</span>
              {ch.title}
            </a>
          )
        })}
      </div>

      {LEARN_CHAPTERS.map(function(ch) {
        return <Chapter key={ch.id} chapter={ch} cards={cards} onOpen={setOpen} />
      })}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
