import { useMemo, useState } from 'react'

var TIER_LABELS = { 1: 'Silver', 2: 'Gold', 3: 'Prismatic' }
var TIER_COLORS = { 1: '#c0c0c0', 2: '#FFC66B', 3: '#d9b9ff' }

export default function Augments(props) {
  var augs = props.data.augments || []
  var meta = props.data.meta || {}

  var _s = useState('all')
  var tierFilter = _s[0]
  var setTierFilter = _s[1]

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var filtered = useMemo(function () {
    return augs.filter(function (a) {
      if (tierFilter !== 'all' && a.tier !== Number(tierFilter)) return false
      if (query) {
        var q = query.toLowerCase()
        if ((a.name || '').toLowerCase().indexOf(q) === -1) return false
      }
      return true
    })
  }, [augs, tierFilter, query])

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>The Gifts</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Augments</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Every augment in the pool, grouped by rarity. Meta tier and avg placement shown when the scraper has fresh data.
        </p>
      </header>

      <div className="d17-panel p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <FilterBtn v="all" l="All" current={tierFilter} set={setTierFilter}/>
          <FilterBtn v="1"   l="Silver"    current={tierFilter} set={setTierFilter} color={TIER_COLORS[1]}/>
          <FilterBtn v="2"   l="Gold"      current={tierFilter} set={setTierFilter} color={TIER_COLORS[2]}/>
          <FilterBtn v="3"   l="Prismatic" current={tierFilter} set={setTierFilter} color={TIER_COLORS[3]}/>
        </div>
        <input
          className="flex-1 min-w-[240px] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider"
          style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
          placeholder="SEARCH AUGMENT..."
          type="text"
          value={query}
          onChange={function(e){ setQuery(e.target.value) }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(function (a) {
          var metaStats = (meta.augments && meta.augments[a.apiName]) || null
          var color = TIER_COLORS[a.tier] || '#9d8e7c'
          return (
            <div key={a.apiName} className="d17-panel p-4" style={{ borderLeft: '3px solid ' + color }}>
              <div className="flex items-start gap-3">
                {a.icon ? (
                  <img
                    alt={a.name}
                    src={a.icon}
                    onError={function(e){ e.target.style.display='none' }}
                    className="w-10 h-10 shrink-0"
                  />
                ) : null}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-editorial italic text-base" style={{ color: color }}>{a.name}</p>
                    {metaStats && metaStats.tier && (
                      <span className="px-1.5 py-0.5 font-mono text-[9px] uppercase" style={{ background: color + '22', color: color, border: '1px solid ' + color + '55' }}>{metaStats.tier}</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-snug font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>{stripHtml(a.desc)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>{TIER_LABELS[a.tier] || '-'}</span>
                    {metaStats && metaStats.avg_placement != null && (
                      <span className="font-mono text-[10px]" style={{ color: '#67e2d9' }}>AVG {Number(metaStats.avg_placement).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 d17-panel p-8 text-center font-mono text-sm" style={{ color: '#9d8e7c' }}>
            NO AUGMENTS MATCH THESE FILTERS
          </div>
        )}
      </div>
    </div>
  )
}

function stripHtml(s) {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, '').replace(/@[A-Za-z0-9_]+@/g, '?').replace(/\s+/g, ' ').trim()
}

function FilterBtn(props) {
  var active = String(props.current) === String(props.v)
  var accent = props.color || '#FFC66B'
  return (
    <button
      type="button"
      onClick={function(){ props.set(props.v) }}
      className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer"
      style={{
        background: active ? accent + '18' : 'transparent',
        color: active ? accent : 'rgba(228,225,236,0.55)',
        border: active ? '1px solid ' + accent + '55' : '1px solid rgba(157,142,124,0.15)'
      }}
    >{props.l}</button>
  )
}
