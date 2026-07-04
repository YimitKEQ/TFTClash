import { useEffect, useMemo, useState } from 'react'
import { Panel, Icon } from '../../components/ui'
import { supabase } from '../../lib/supabase.js'
import { loadCards, findLegendCard } from '../../lib/riftbound/cards.js'
import { TIER_LABELS, TIER_ORDER } from '../../lib/riftbound/content.js'
import { CardThumb, CardModal, DomainIcon } from './CardBits.jsx'

var META_KEY = 'riftbound_meta'

var TIER_ACCENT = {
  S: '#E8A838',
  1: '#D9B9FF',
  2: '#4ECDC4',
  3: '#8B8B96',
}

function TierEntry(props) {
  var entry = props.entry
  var card = props.card
  var onOpen = props.onOpen
  var domains = (entry.domains && entry.domains.length ? entry.domains : null) ||
    (card && card.d ? card.d.map(function(d) { return d.toLowerCase() }) : [])
  return (
    <div className="flex gap-4 py-4 border-b border-outline-variant/10 last:border-0">
      {card ? (
        <div className="w-20 sm:w-24 flex-shrink-0">
          <CardThumb card={card} onOpen={onOpen} width={220} />
        </div>
      ) : (
        <div className="w-20 sm:w-24 flex-shrink-0 rounded-lg border border-outline-variant/15 bg-surface-container-low flex items-center justify-center" style={{ aspectRatio: '744 / 1039' }}>
          <Icon name="playing_cards" size={20} className="text-on-surface-variant/30" />
        </div>
      )}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex gap-1">
            {domains.map(function(id) {
              var name = id.charAt(0).toUpperCase() + id.slice(1)
              return <DomainIcon key={id} name={name} size={15} />
            })}
          </div>
          <span className="font-display text-base text-on-surface truncate">{entry.name}</span>
        </div>
        {entry.blurb && <p className="text-sm text-on-surface-variant/75 leading-relaxed max-w-xl">{entry.blurb}</p>}
      </div>
    </div>
  )
}

export default function MetaSection() {
  var _entries = useState([])
  var entries = _entries[0]
  var setEntries = _entries[1]
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]
  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]
  var _updatedAt = useState(null)
  var updatedAt = _updatedAt[0]
  var setUpdatedAt = _updatedAt[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    supabase.from('site_settings').select('value,updated_at').eq('key', META_KEY).maybeSingle()
      .then(function(res) {
        if (!alive) return
        setLoading(false)
        if (res.error || !res.data) return
        try {
          var raw = res.data.value
          var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed)) setEntries(parsed)
          setUpdatedAt(res.data.updated_at || null)
        } catch (e) {}
      })
    return function() { alive = false }
  }, [])

  var withCards = useMemo(function() {
    return entries.map(function(e) {
      return { entry: e, card: cards ? findLegendCard(cards, e.name) : null }
    })
  }, [entries, cards])

  var byTier = {}
  withCards.forEach(function(item) {
    var t = item.entry.tier || '3'
    if (!byTier[t]) byTier[t] = []
    byTier[t].push(item)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant/60 max-w-lg">
          Curated by TFT Clash staff from tournament results and published tier lists. A snapshot of what is actually winning, updated as the meta shifts.
        </p>
        {updatedAt && (
          <span className="text-[10px] font-mono text-on-surface-variant/40">
            {'Updated ' + new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map(function(k) { return <div key={k} className="h-32 rounded-xl border border-outline-variant/15 bg-surface-container/60 animate-pulse" /> })}
        </div>
      ) : entries.length === 0 ? (
        <Panel padding="spacious" className="text-center">
          <Icon name="auto_awesome" size={28} className="text-on-surface-variant/35 block mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant/70">No meta data yet. Check back soon.</p>
        </Panel>
      ) : (
        TIER_ORDER.filter(function(t) { return byTier[t] && byTier[t].length }).map(function(t) {
          var meta = TIER_LABELS[t] || { label: 'Tier ' + t, desc: '' }
          var accent = TIER_ACCENT[t] || '#8B8B96'
          return (
            <Panel key={t} padding="spacious" className="relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} aria-hidden="true" />
              <div className="mb-2">
                <h3 className="font-display text-lg" style={{ color: accent }}>{meta.label}</h3>
                {meta.desc && <p className="text-xs text-on-surface-variant/55 mt-0.5">{meta.desc}</p>}
              </div>
              <div>
                {byTier[t].map(function(item, i) {
                  return <TierEntry key={item.entry.id || i} entry={item.entry} card={item.card} onOpen={setOpen} />
                })}
              </div>
            </Panel>
          )
        })
      )}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
