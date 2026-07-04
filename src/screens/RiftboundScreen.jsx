import { useEffect, useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon, PillTab, PillTabGroup } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import {
  RIFTBOUND_OVERVIEW, WIN_CONDITION, CARD_TYPES, DOMAINS,
  DECKBUILDING_BASICS, GLOSSARY, TIER_LABELS, TIER_ORDER,
} from '../lib/riftboundContent.js'

var META_KEY = 'riftbound_meta'

function DomainChip(props) {
  var d = props.domain
  return (
    <div
      className="rounded-lg p-4 border"
      style={{ borderColor: d.color + '40', background: d.color + '0f' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
        <span className="font-display text-sm uppercase tracking-wide text-on-surface">{d.name}</span>
      </div>
      <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/50 mb-1.5">{d.identity}</div>
      <p className="text-xs text-on-surface-variant/80 leading-relaxed">{d.desc}</p>
    </div>
  )
}

function CardTypeRow(props) {
  var c = props.cardType
  return (
    <div className="flex gap-3 py-3 border-b border-outline-variant/10 last:border-0">
      <div className="w-9 h-9 rounded bg-surface-container-low flex items-center justify-center flex-shrink-0">
        <Icon name={c.icon} size={18} className="text-primary" />
      </div>
      <div>
        <div className="font-display text-sm text-on-surface mb-0.5">{c.name}</div>
        <p className="text-xs text-on-surface-variant/70 leading-relaxed">{c.desc}</p>
      </div>
    </div>
  )
}

function HowToPlaySection() {
  return (
    <div className="space-y-8">
      <Panel padding="spacious" accent="gold">
        <span className="font-label text-primary uppercase tracking-[0.2em] text-xs mb-2 block">{RIFTBOUND_OVERVIEW.tagline}</span>
        <p className="font-body text-on-surface-variant text-sm leading-relaxed max-w-2xl">{RIFTBOUND_OVERVIEW.blurb}</p>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel padding="spacious">
          <h3 className="font-display text-lg text-on-surface mb-4">{WIN_CONDITION.title}</h3>
          <ul className="space-y-2.5">
            {WIN_CONDITION.points.map(function(p, i) {
              return (
                <li key={i} className="flex gap-2.5 text-sm text-on-surface-variant/85 leading-relaxed">
                  <Icon name="check_circle" size={16} className="text-tertiary flex-shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel padding="spacious">
          <h3 className="font-display text-lg text-on-surface mb-4">{DECKBUILDING_BASICS.title}</h3>
          <ul className="space-y-2.5">
            {DECKBUILDING_BASICS.points.map(function(p, i) {
              return (
                <li key={i} className="flex gap-2.5 text-sm text-on-surface-variant/85 leading-relaxed">
                  <Icon name="style" size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Panel padding="spacious">
        <h3 className="font-display text-lg text-on-surface mb-1">Card Types</h3>
        <p className="text-xs text-on-surface-variant/60 mb-3">What each card in your deck actually does.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {CARD_TYPES.map(function(c) { return <CardTypeRow key={c.id} cardType={c} /> })}
        </div>
      </Panel>

      <Panel padding="spacious">
        <h3 className="font-display text-lg text-on-surface mb-1">The Six Domains</h3>
        <p className="text-xs text-on-surface-variant/60 mb-4">Every Legend draws from two of these. They're the closest thing Riftbound has to "colors."</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DOMAINS.map(function(d) { return <DomainChip key={d.id} domain={d} /> })}
        </div>
      </Panel>

      <Panel padding="spacious">
        <h3 className="font-display text-lg text-on-surface mb-4">Glossary</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {GLOSSARY.map(function(g) {
            return (
              <div key={g.term}>
                <dt className="font-label text-xs uppercase tracking-widest text-primary mb-0.5">{g.term}</dt>
                <dd className="text-xs text-on-surface-variant/75 leading-relaxed">{g.def}</dd>
              </div>
            )
          })}
        </dl>
      </Panel>
    </div>
  )
}

function domainColor(domainId) {
  var d = DOMAINS.find(function(x) { return x.id === domainId })
  return d ? d.color : '#888'
}

function TierRow(props) {
  var entry = props.entry
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-outline-variant/10 last:border-0">
      <div className="flex gap-1 pt-1 flex-shrink-0">
        {(entry.domains || []).map(function(id) {
          return <span key={id} className="w-2.5 h-2.5 rounded-full" style={{ background: domainColor(id) }} title={id} />
        })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-on-surface">{entry.name}</div>
        {entry.blurb && <p className="text-xs text-on-surface-variant/75 leading-relaxed mt-1">{entry.blurb}</p>}
      </div>
    </div>
  )
}

function MetaTierSection() {
  var _entries = useState([])
  var entries = _entries[0]
  var setEntries = _entries[1]
  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]
  var _updatedAt = useState(null)
  var updatedAt = _updatedAt[0]
  var setUpdatedAt = _updatedAt[1]

  useEffect(function() {
    var alive = true
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

  var byTier = {}
  entries.forEach(function(e) {
    var t = e.tier || '3'
    if (!byTier[t]) byTier[t] = []
    byTier[t].push(e)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant/60 max-w-lg">
          Curated by TFT Clash staff. Not live-tracked win rates - a snapshot of what's actually winning, updated as the meta shifts.
        </p>
        {updatedAt && (
          <span className="text-[10px] font-mono text-on-surface-variant/40">
            Updated {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map(function(k) { return <div key={k} className="h-24 rounded-xl border border-outline-variant/15 bg-surface-container/60 animate-pulse" /> })}
        </div>
      ) : entries.length === 0 ? (
        <Panel padding="spacious" className="text-center">
          <Icon name="auto_awesome" size={28} className="text-on-surface-variant/35 block mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant/70">No meta data yet. Check back soon.</p>
        </Panel>
      ) : (
        TIER_ORDER.filter(function(t) { return byTier[t] && byTier[t].length }).map(function(t) {
          var meta = TIER_LABELS[t] || { label: 'Tier ' + t, desc: '' }
          return (
            <Panel key={t} padding="spacious">
              <div className="mb-3">
                <h3 className="font-display text-lg text-on-surface">{meta.label}</h3>
                {meta.desc && <p className="text-xs text-on-surface-variant/55 mt-0.5">{meta.desc}</p>}
              </div>
              <div>
                {byTier[t].map(function(e, i) { return <TierRow key={e.id || i} entry={e} /> })}
              </div>
            </Panel>
          )
        })
      )}
    </div>
  )
}

export default function RiftboundScreen() {
  var _tab = useState('play')
  var tab = _tab[0]
  var setTab = _tab[1]

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-5xl mx-auto mb-12">
        <div className="mb-8">
          <span className="font-label text-primary uppercase tracking-[0.2em] text-sm mb-2 block">Riftbound</span>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-on-surface mb-3">Riftbound Hub</h1>
          <p className="font-body text-on-surface-variant text-sm max-w-2xl">
            How to play, the six Domains, and a staff-curated snapshot of what's winning right now.
          </p>
        </div>

        <PillTabGroup className="mb-8">
          <PillTab active={tab === 'play'} onClick={function() { setTab('play') }}>How to Play</PillTab>
          <PillTab active={tab === 'meta'} onClick={function() { setTab('meta') }}>Meta Tier List</PillTab>
        </PillTabGroup>

        {tab === 'play' ? <HowToPlaySection /> : <MetaTierSection />}
      </div>
    </PageLayout>
  )
}
