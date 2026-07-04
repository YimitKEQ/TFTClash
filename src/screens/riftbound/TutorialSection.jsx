import { useEffect, useMemo, useState } from 'react'
import { Panel, Icon } from '../../components/ui'
import { loadCards, findByName, domainColor } from '../../lib/riftbound/cards.js'
import { SCENARIO } from '../../lib/riftbound/scenario.js'
import { CardThumb, CardModal, DomainIcon } from './CardBits.jsx'

var PHASE_COLORS = {
  Setup: '#8B8B96', Awaken: '#D9B9FF', Beginning: '#E8A838', Channel: '#4ECDC4',
  Draw: '#3B82F6', Main: '#2FB380', Combat: '#E5484D', Showdown: '#E5484D',
  Ending: '#9B59B6', Victory: '#E8A838',
}

function phaseColor(phase) {
  return PHASE_COLORS[phase] || '#8B8B96'
}

// A clickable chip representing one unit standing somewhere on the board.
function UnitChip(props) {
  var name = props.name
  var cards = props.cards
  var onOpen = props.onOpen
  var enemy = props.enemy
  var card = cards ? findByName(cards, name) : null
  var might = card && card.m != null ? card.m : null
  return (
    <button
      type="button"
      onClick={function() { if (card && onOpen) onOpen(card) }}
      className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-colors cursor-pointer max-w-full ' + (enemy ? 'bg-error/10 border-error/30 text-error/90 hover:bg-error/20' : 'bg-tertiary/10 border-tertiary/30 text-tertiary hover:bg-tertiary/20')}
      title={name}
    >
      <span className="truncate">{name.split(' - ')[0]}</span>
      {might != null && <span className="font-mono flex-shrink-0">{might}</span>}
    </button>
  )
}

function ZoneBox(props) {
  var label = props.label
  var units = props.units || []
  var cards = props.cards
  var onOpen = props.onOpen
  var enemy = props.enemy
  var highlight = props.highlight
  return (
    <div className={'rounded-lg border px-2 py-1.5 min-h-[34px] transition-colors ' + (highlight ? 'border-primary/50 bg-primary/8' : 'border-outline-variant/15 bg-surface-container-lowest/60')}>
      <div className="text-[9px] font-label uppercase tracking-widest text-on-surface-variant/45 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {units.length === 0
          ? <span className="text-[9px] text-on-surface-variant/25 italic">empty</span>
          : units.map(function(u, i) { return <UnitChip key={u + i} name={u} cards={cards} onOpen={onOpen} enemy={enemy} /> })}
      </div>
    </div>
  )
}

function SideStats(props) {
  var label = props.label
  var side = props.side
  var enemy = props.enemy
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={'font-display text-xs uppercase tracking-wide ' + (enemy ? 'text-error/80' : 'text-tertiary')}>{label}</span>
      <div className="flex items-center gap-2.5 font-mono text-[11px]">
        <span className="inline-flex items-center gap-1 text-on-surface-variant/70" title="Runes on board">
          <Icon name="diamond" size={12} className="text-secondary" aria-hidden="true" />
          {side.runes}
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-primary" title="Points">
          <Icon name="star" size={12} fill aria-hidden="true" />
          {side.points}
        </span>
      </div>
    </div>
  )
}

// The whole board at one step: opponent strip, two battlefields with each
// side's units, your strip. Battlefield cards are the real landscape cards.
function BoardView(props) {
  var board = props.board
  var battlefields = props.battlefields
  var cards = props.cards
  var onOpen = props.onOpen
  var bf1Card = cards ? findByName(cards, battlefields[0]) : null
  var bf2Card = cards ? findByName(cards, battlefields[1]) : null
  return (
    <div className="space-y-2">
      <SideStats label={'Opponent (Garen)'} side={board.opp} enemy />
      <ZoneBox label="Opponent base" units={board.opp.base} cards={cards} onOpen={onOpen} enemy />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map(function(i) {
          var bfCard = i === 0 ? bf1Card : bf2Card
          var youUnits = i === 0 ? board.you.bf1 : board.you.bf2
          var oppUnits = i === 0 ? board.opp.bf1 : board.opp.bf2
          return (
            <div key={i} className="space-y-1.5">
              <ZoneBox label="Their units" units={oppUnits} cards={cards} onOpen={onOpen} enemy />
              {bfCard ? (
                <CardThumb card={bfCard} onOpen={onOpen} width={440} />
              ) : (
                <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest flex items-center justify-center text-[10px] text-on-surface-variant/40" style={{ aspectRatio: '1039 / 744' }}>
                  {battlefields[i]}
                </div>
              )}
              <ZoneBox label="Your units" units={youUnits} cards={cards} onOpen={onOpen} highlight={youUnits.length > 0} />
            </div>
          )
        })}
      </div>
      <ZoneBox label="Your base" units={board.you.base} cards={cards} onOpen={onOpen} />
      <SideStats label={'You (Annie)'} side={board.you} />
    </div>
  )
}

export default function TutorialSection() {
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]
  var _idx = useState(-1)
  var idx = _idx[0]
  var setIdx = _idx[1]
  var _picked = useState(null)
  var picked = _picked[0]
  var setPicked = _picked[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    return function() { alive = false }
  }, [])

  var steps = SCENARIO.steps
  var step = idx >= 0 && idx < steps.length ? steps[idx] : null

  var stepCards = useMemo(function() {
    if (!step || !cards || !step.cards) return []
    return step.cards.map(function(n) { return findByName(cards, n) }).filter(Boolean)
  }, [step, cards])

  function goNext() {
    setPicked(null)
    setIdx(function(prev) { return Math.min(prev + 1, steps.length) })
  }
  function goBack() {
    setPicked(null)
    setIdx(function(prev) { return Math.max(prev - 1, 0) })
  }

  // Arrow keys page through steps (blocked forward while a quiz is unanswered,
  // and fully paused while the card viewer is open so browsing a card never
  // silently advances the tutorial underneath it).
  useEffect(function() {
    function onKey(e) {
      if (open) return
      var tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (idx < 0 || idx >= steps.length) return
      if (e.key === 'ArrowRight') {
        var cur = steps[idx]
        if (cur && cur.choice && picked === null) return
        goNext()
      } else if (e.key === 'ArrowLeft') {
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return function() { window.removeEventListener('keydown', onKey) }
  }, [idx, picked, steps, open])

  // Intro screen
  if (idx < 0) {
    return (
      <Panel padding="spacious" className="text-center">
        <Icon name="swords" size={40} className="text-primary block mx-auto mb-3" />
        <h3 className="font-display text-2xl text-on-surface mb-2">{SCENARIO.title}</h3>
        <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-xl mx-auto mb-6">{SCENARIO.intro}</p>
        <div className="flex items-center justify-center gap-6 mb-7">
          {[{ who: SCENARIO.you, label: 'You' }, { who: SCENARIO.opp, label: 'Opponent' }].map(function(p, i) {
            var legend = cards ? findByName(cards, p.who.legend) : null
            return (
              <div key={i} className="w-32 sm:w-40">
                <div className={'font-label text-[10px] uppercase tracking-widest mb-1.5 ' + (i === 0 ? 'text-tertiary' : 'text-error/80')}>{p.label}</div>
                {legend
                  ? <CardThumb card={legend} onOpen={setOpen} width={220} />
                  : <div className="rounded-lg bg-surface-container/60 animate-pulse" style={{ aspectRatio: '744 / 1039' }} />}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={function() { setIdx(0) }}
          className="px-8 py-3 bg-primary text-on-primary font-label font-bold text-sm uppercase tracking-widest rounded-full hover:brightness-110 transition-all cursor-pointer"
        >
          Start the Tutorial
        </button>
        <p className="text-[10px] text-on-surface-variant/40 mt-3">{steps.length + ' steps, about 5 minutes, no rules knowledge needed'}</p>
        <CardModal card={open} onClose={function() { setOpen(null) }} />
      </Panel>
    )
  }

  // Outro screen
  if (idx >= steps.length) {
    return (
      <Panel padding="spacious" className="text-center">
        <Icon name="emoji_events" size={40} fill className="text-primary block mx-auto mb-3" />
        <h3 className="font-display text-2xl text-on-surface mb-2">You know how to play</h3>
        <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-xl mx-auto mb-6">{SCENARIO.outro}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={function() { setIdx(-1) }}
            className="px-6 py-2.5 bg-surface-container-high text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            Replay
          </button>
          <a
            href="#learn"
            className="px-6 py-2.5 bg-primary/10 border border-primary/30 text-primary font-label font-bold text-xs uppercase tracking-widest rounded-full hover:bg-primary/20 transition-colors no-underline"
          >
            Read the full guide
          </a>
        </div>
      </Panel>
    )
  }

  var choiceMade = picked !== null
  var needsChoice = !!step.choice && !choiceMade

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Board (below the narration on mobile so the step text and controls
          are immediately visible without scrolling past the whole board) */}
      <Panel padding="tight" className="lg:col-span-7 order-2 lg:order-1">
        <BoardView board={step.board} battlefields={SCENARIO.battlefields} cards={cards} onOpen={setOpen} />
      </Panel>

      {/* Narration + controls */}
      <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4 order-1 lg:order-2">
        <Panel padding="spacious">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-label text-[10px] uppercase tracking-widest"
              style={{ color: phaseColor(step.phase), borderColor: phaseColor(step.phase) + '55', background: phaseColor(step.phase) + '14' }}
            >
              {'Turn ' + step.turn + ' - ' + step.phase}
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant/40">{(idx + 1) + ' / ' + steps.length}</span>
          </div>
          <div className="flex gap-0.5 mb-4" aria-hidden="true">
            {steps.map(function(s, si) {
              return (
                <span
                  key={s.id}
                  className={'flex-1 h-1 rounded-full transition-colors duration-300 ' + (si < idx ? 'bg-primary' : si === idx ? 'bg-secondary' : 'bg-surface-container-lowest')}
                />
              )
            })}
          </div>

          <div aria-live="polite">
            <h3 className="font-display text-lg text-on-surface mb-2">{step.title}</h3>
            <p className="text-sm text-on-surface-variant/85 leading-relaxed">{step.text}</p>
          </div>

          {stepCards.length > 0 && (
            <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1">
              {stepCards.map(function(c) {
                return (
                  <div key={c.id} className="w-24 sm:w-28 flex-shrink-0">
                    <CardThumb card={c} onOpen={setOpen} width={220} />
                  </div>
                )
              })}
            </div>
          )}

          {step.choice && (
            <div className="mt-4 rounded-lg border border-secondary/25 bg-secondary/8 p-3.5">
              <p className="text-xs font-semibold text-secondary mb-2.5">{step.choice.prompt}</p>
              <div className="space-y-1.5">
                {step.choice.options.map(function(opt, oi) {
                  var isPicked = picked === oi
                  var cls = 'w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer '
                  if (isPicked && opt.correct) cls += 'border-tertiary/60 bg-tertiary/15 text-tertiary'
                  else if (isPicked) cls += 'border-error/60 bg-error/15 text-error'
                  else if (choiceMade) cls += 'border-outline-variant/15 text-on-surface-variant/40'
                  else cls += 'border-outline-variant/25 text-on-surface/80 hover:border-secondary/50 hover:bg-secondary/10'
                  return (
                    <button key={oi} type="button" disabled={choiceMade} onClick={function() { setPicked(oi) }} className={cls}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {choiceMade && (
                <p role="status" className={'text-xs leading-relaxed mt-2.5 ' + (step.choice.options[picked].correct ? 'text-tertiary' : 'text-on-surface-variant/75')}>
                  {step.choice.options[picked].response}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-5">
            <button
              type="button"
              onClick={goBack}
              disabled={idx === 0}
              className="px-4 py-2 bg-surface-container-high text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-full disabled:opacity-30 hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={needsChoice}
              className={'px-6 py-2 font-label font-bold text-xs uppercase tracking-widest rounded-full transition-all cursor-pointer ' + (needsChoice ? 'bg-surface-container-high text-on-surface-variant/40' : 'bg-primary text-on-primary hover:brightness-110')}
            >
              {needsChoice ? 'Pick an answer' : idx === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </Panel>
      </div>

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
