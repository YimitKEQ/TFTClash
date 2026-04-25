import { useState, useMemo } from 'react'
import meetData from '../data/meet.json'
import { makeImgFallback, costColor } from '../lib/imgFallback'

var TYPE_ORDER = [
  'Opener',
  'Augment',
  'Emblem',
  'God',
  'Arbiter',
  'Item',
  'Worth the Wait 1',
  'Worth the Wait 2',
  'Fast 9'
]

var TYPE_META = {
  'Opener':           { icon: 'rocket_launch',     color: '#FFC66B', desc: 'What you see on 2-1 and the comp it pushes you into.' },
  'Augment':          { icon: 'auto_awesome',      color: '#d9b9ff', desc: 'Augment picks and the lines they enable.' },
  'Emblem':           { icon: 'workspace_premium', color: '#ff9d6b', desc: 'When you hit a vertical-trait emblem, here is what to play.' },
  'God':              { icon: 'flare',             color: '#ff6b9d', desc: 'Each Space God boon and how to spend it.' },
  'Arbiter':          { icon: 'gavel',             color: '#9d8eff', desc: 'Arbiter rules and the comps that exploit them.' },
  'Item':             { icon: 'inventory_2',       color: '#67e2d9', desc: 'Specific items and item combos worth pivoting for.' },
  'Worth the Wait 1': { icon: 'hourglass_top',     color: '#c0c0c0', desc: 'First batch of slow-bake units and their plans.' },
  'Worth the Wait 2': { icon: 'hourglass_bottom',  color: '#67e2d9', desc: 'Second batch of slow-bake units and their plans.' },
  'Fast 9':           { icon: 'speed',             color: '#ff6b9d', desc: 'When and how to fast-9 instead of rolling on a board.' }
}

function metaFor(type) {
  var key = (type || '').trim()
  return TYPE_META[key] || { icon: 'menu_book', color: '#9d8e7c', desc: '' }
}

function normalizeType(raw) {
  if (!raw) return 'Other'
  return raw.trim()
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanCondition(condition, type) {
  if (!condition) return ''
  var t = (type || '').trim()
  if (!t) return condition
  var pattern = new RegExp('^' + escapeRegex(t) + '\\s*[-:]\\s*', 'i')
  return condition.replace(pattern, '').trim()
}

function stageBadge(stage) {
  if (!stage) return null
  var s = String(stage).trim()
  if (s === 'Any' || s.toLowerCase() === 'any') {
    return (
      <span
        className="font-mono uppercase tracking-widest text-[10px] px-2 py-0.5"
        style={{ background: 'rgba(157,142,124,0.10)', color: '#9d8e7c' }}
      >Any Stage</span>
    )
  }
  return (
    <span
      className="font-mono uppercase tracking-widest text-[10px] px-2 py-0.5"
      style={{ background: 'rgba(103, 226, 217, 0.12)', color: '#67e2d9', border: '1px solid rgba(103, 226, 217, 0.30)' }}
    >Stage {s}</span>
  )
}

function highlight(text, query) {
  if (!query) return text
  var q = query.toLowerCase()
  var lower = text.toLowerCase()
  var idx = lower.indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(255, 198, 107, 0.32)', color: '#FFC66B', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

var KEYWORD_HINTS = [
  { test: /reroll/i,        icon: 'casino',          color: '#d9b9ff' },
  { test: /tempo/i,         icon: 'trending_up',     color: '#67e2d9' },
  { test: /fast\s*9/i,      icon: 'speed',           color: '#ff6b9d' },
  { test: /fast\s*8/i,      icon: 'speed',           color: '#ff9d6b' },
  { test: /flex/i,          icon: 'tune',            color: '#9d8eff' },
  { test: /winstreak/i,     icon: 'trending_up',     color: '#67e2d9' },
  { test: /lose\s*streak/i, icon: 'trending_down',   color: '#ff9d6b' }
]

// Curated item alias map: each entry maps a regex pattern to a canonical item apiName.
// We keep this list short and confident -- only items that show up in the prep sheet.
var ITEM_ALIASES = [
  { re: /\badaptive\s+helm\b|\badaptive\b/i,    api: 'TFT_Item_AdaptiveHelm' },
  { re: /\bshojin\b/i,                          api: 'TFT_Item_SpearOfShojin' },
  { re: /\bnashor[\s']*s?\s*tooth\b|\bnashor\b/i, api: 'TFT_Item_Leviathan' },
  { re: /\brageblade\b|\bguinsoo[\s']*s?\b/i,   api: 'TFT_Item_GuinsoosRageblade' },
  { re: /\bjeweled\s+gauntlet\b|\bjg\b/i,       api: 'TFT_Item_JeweledGauntlet' },
  { re: /\bblue\s+buff\b/i,                     api: 'TFT_Item_BlueBuff' },
  { re: /\btear\b/i,                            api: 'TFT_Item_TearOfTheGoddess' },
  { re: /\bbloodthirster\b/i,                   api: 'TFT_Item_Bloodthirster' },
  { re: /\bhand\s+of\s+justice\b|\bhoj\b/i,     api: 'TFT_Item_HandOfJustice' },
  { re: /\bquicksilver\b|\bqss\b/i,             api: 'TFT_Item_Quicksilver' },
  { re: /\bbramble(\s+vest)?\b/i,               api: 'TFT_Item_BrambleVest' },
  { re: /\bedge\s+of\s+night\b|\beon\b/i,       api: 'TFT_Item_EdgeOfNight' },
  { re: /\bsteraks?\b/i,                        api: 'TFT_Item_SteraksGage' },
  { re: /\btitans?\b/i,                         api: 'TFT_Item_TitansResolve' },
  { re: /\bgiant\s+slayer\b|\bgs\b/i,           api: 'TFT_Item_GiantSlayer' },
  { re: /\bmorello[\s']*s?\b/i,                 api: 'TFT_Item_MorellonomiconEmblem' },
  { re: /\bdeathblade\b/i,                      api: 'TFT_Item_Deathblade' },
  { re: /\binfinity\s+edge\b|\bie\b/i,          api: 'TFT_Item_InfinityEdge' },
  { re: /\blast\s+whisper\b|\blw\b/i,           api: 'TFT_Item_LastWhisper' },
  { re: /\bdragon[\s']*s?\s*claw\b/i,           api: 'TFT_Item_DragonsClaw' },
  { re: /\bgargoyle[\s']*s?\b|\bstoneplate\b/i, api: 'TFT_Item_GargoyleStoneplate' },
  { re: /\bredemption\b/i,                      api: 'TFT_Item_Redemption' },
  { re: /\bsunfire\s+cape\b|\bsunfire\b/i,      api: 'TFT_Item_SunfireCape' },
  { re: /\barchangel[\s']*s?\b|\bstaff\b/i,     api: 'TFT_Item_ArchangelsStaff' },
  { re: /\bhextech\s+gunblade\b|\bgunblade\b/i, api: 'TFT_Item_HextechGunblade' },
  { re: /\bwarmog[\s']*s?\b/i,                  api: 'TFT_Item_Warmogs' },
  { re: /\bevenshroud\b/i,                      api: 'TFT_Item_Evenshroud' },
  { re: /\bcrownguard\b/i,                      api: 'TFT_Item_Crownguard' }
]

function findChampions(text, champLookup) {
  if (!text || !champLookup) return []
  var seen = {}
  var found = []
  champLookup.patterns.forEach(function (p) {
    if (p.re.test(text) && !seen[p.key]) {
      seen[p.key] = true
      var champ = champLookup.byKey[p.key]
      if (champ) found.push(champ)
    }
  })
  return found
}

function findItems(text, itemByApi) {
  if (!text || !itemByApi) return []
  var seen = {}
  var found = []
  ITEM_ALIASES.forEach(function (a) {
    if (a.re.test(text) && !seen[a.api]) {
      var item = itemByApi[a.api]
      if (item) {
        seen[a.api] = true
        found.push(item)
      }
    }
  })
  return found
}

function ChampChip(props) {
  var ch = props.champ
  return (
    <div
      className="flex items-center gap-2 px-1.5 py-1"
      style={{ background: '#0e0d15', border: '1px solid ' + costColor(ch.cost) + '55' }}
      title={ch.name + ' (cost ' + ch.cost + ')'}
    >
      <img
        alt={ch.name}
        src={ch.assets && ch.assets.face}
        onError={makeImgFallback(ch.cost)}
        className="w-7 h-7 object-cover shrink-0"
        style={{ border: '1px solid ' + costColor(ch.cost) }}
      />
      <span className="font-mono text-[10px] uppercase tracking-wide pr-1" style={{ color: '#E4E1EC' }}>
        {ch.name}
      </span>
    </div>
  )
}

function ItemChip(props) {
  var it = props.item
  return (
    <div
      className="flex items-center gap-2 px-1.5 py-1"
      style={{ background: '#0e0d15', border: '1px solid rgba(103, 226, 217, 0.35)' }}
      title={it.name}
    >
      {it.icon && (
        <img
          alt={it.name}
          src={it.icon}
          className="w-6 h-6 object-cover shrink-0"
          style={{ border: '1px solid rgba(103, 226, 217, 0.40)' }}
          onError={function (e) { e.target.style.display = 'none' }}
        />
      )}
      <span className="font-mono text-[10px] uppercase tracking-wide pr-1" style={{ color: '#67e2d9' }}>
        {it.name}
      </span>
    </div>
  )
}

function MentionsRow(props) {
  var champs = props.champs || []
  var items = props.items || []
  if (champs.length === 0 && items.length === 0) return null
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(157,142,124,0.20)' }}>
      {champs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono uppercase tracking-widest text-[9px]" style={{ color: '#9d8e7c' }}>Units</span>
          {champs.map(function (c) { return <ChampChip key={c.apiName || c.key} champ={c}/> })}
        </div>
      )}
      {items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono uppercase tracking-widest text-[9px]" style={{ color: '#9d8e7c' }}>Items</span>
          {items.map(function (i) { return <ItemChip key={i.apiName} item={i}/> })}
        </div>
      )}
    </div>
  )
}

function CompTags(props) {
  var comp = (props.comp || '').trim()
  if (!comp) return null
  var query = props.query
  var parts = comp.split(/\s*\/\s*|\s+or\s+/i).map(function (s) { return s.trim() }).filter(Boolean)
  if (parts.length === 1) {
    var hint = KEYWORD_HINTS.find(function (h) { return h.test.test(comp) })
    return (
      <div className="flex items-start gap-2">
        <span
          className="material-symbols-outlined shrink-0"
          style={{ color: hint ? hint.color : '#9d8e7c', fontSize: 16, marginTop: 2 }}
        >{hint ? hint.icon : 'groups'}</span>
        <p className="font-body text-sm leading-snug" style={{ color: '#E4E1EC' }}>
          {highlight(comp, query)}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="material-symbols-outlined shrink-0" style={{ color: '#9d8e7c', fontSize: 16, marginTop: 2 }}>groups</span>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {parts.map(function (p, i) {
          var hint = KEYWORD_HINTS.find(function (h) { return h.test.test(p) })
          var c = hint ? hint.color : '#FFC66B'
          return (
            <span
              key={i}
              className="font-mono text-[10px] px-2 py-1 uppercase tracking-wide flex items-center gap-1"
              style={{ background: c + '14', color: c, border: '1px solid ' + c + '40' }}
            >
              {hint && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{hint.icon}</span>}
              {highlight(p, query)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function NotesBlock(props) {
  var notes = (props.notes || '').trim()
  if (!notes) return null
  var query = props.query
  var paragraphs = notes.split(/\n{2,}/).map(function (p) { return p.trim() }).filter(Boolean)
  return (
    <div
      className="flex items-start gap-2 mt-4 pt-3"
      style={{ borderTop: '1px dashed rgba(255,198,107,0.18)' }}
    >
      <span className="material-symbols-outlined shrink-0" style={{ color: '#FFC66B', fontSize: 16, marginTop: 2 }}>tips_and_updates</span>
      <div className="flex-1 min-w-0 space-y-2">
        {paragraphs.map(function (p, i) {
          return (
            <p key={i} className="font-body text-[13px] leading-relaxed whitespace-pre-line" style={{ color: 'rgba(228, 225, 236, 0.78)' }}>
              {highlight(p, query)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function MeetCard(props) {
  var row = props.row
  var query = props.query
  var champLookup = props.champLookup
  var itemByApi = props.itemByApi
  var meta = metaFor(row.type)
  var titleText = cleanCondition(row.condition, row.type)
  var hay = (row.condition || '') + ' ' + (row.comp || '') + ' ' + (row.notes || '')
  var champs = useMemo(function () { return findChampions(hay, champLookup) }, [hay, champLookup])
  var items  = useMemo(function () { return findItems(hay, itemByApi) }, [hay, itemByApi])

  return (
    <article
      className="d17-panel p-5 transition-colors"
      style={{ borderLeft: '3px solid ' + meta.color }}
    >
      <div className="flex items-start gap-4 mb-3">
        <div
          className="shrink-0 w-11 h-11 flex items-center justify-center"
          style={{ background: meta.color + '14', border: '1px solid ' + meta.color + '40' }}
        >
          <span className="material-symbols-outlined" style={{ color: meta.color, fontSize: 22 }}>{meta.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className="font-mono uppercase tracking-widest text-[10px] px-2 py-0.5"
              style={{ background: meta.color + '12', color: meta.color, border: '1px solid ' + meta.color + '30' }}
            >
              {row.type || 'Other'}
            </span>
            {stageBadge(row.stage)}
          </div>
          <h3
            className="font-editorial italic text-xl leading-snug"
            style={{ color: '#F5F2EC' }}
          >
            {highlight(titleText, query)}
          </h3>
        </div>
      </div>

      <CompTags comp={row.comp} query={query} />

      <NotesBlock notes={row.notes} query={query} />

      <MentionsRow champs={champs} items={items} />
    </article>
  )
}

function StatChip(props) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ background: '#0e0d15', border: '1px solid rgba(255, 198, 107, 0.18)' }}
    >
      <span className="material-symbols-outlined" style={{ color: props.color || '#FFC66B', fontSize: 18 }}>{props.icon}</span>
      <div>
        <p className="font-mono uppercase tracking-widest text-[9px]" style={{ color: '#9d8e7c' }}>{props.label}</p>
        <p className="font-editorial italic text-base leading-none mt-0.5" style={{ color: props.color || '#FFC66B' }}>{props.value}</p>
      </div>
    </div>
  )
}

function FilterBtn(props) {
  var active = props.active
  var color = props.color || '#FFC66B'
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="font-mono text-[10px] py-1.5 px-3 uppercase cursor-pointer flex items-center gap-1.5 transition-colors"
      style={{
        background: active ? color + '18' : 'transparent',
        color: active ? color : 'rgba(228,225,236,0.60)',
        border: active ? '1px solid ' + color + '60' : '1px solid rgba(157,142,124,0.18)'
      }}
    >
      {props.icon && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{props.icon}</span>}
      {props.label}
      {props.count != null && (
        <span
          className="font-mono text-[9px] px-1 leading-none"
          style={{ color: active ? color : 'rgba(228,225,236,0.40)' }}
        >{props.count}</span>
      )}
    </button>
  )
}

export default function Meet(props) {
  var data = props && props.data ? props.data : {}
  var champions = data.champions || []
  var items = data.items || []

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var _t = useState('All')
  var typeFilter = _t[0]
  var setTypeFilter = _t[1]

  var _s = useState('All')
  var stageFilter = _s[0]
  var setStageFilter = _s[1]

  var rows = meetData

  var champLookup = useMemo(function () {
    var byKey = {}
    var patterns = []
    champions.forEach(function (c) {
      if (!c || !c.key || !c.name) return
      byKey[c.key] = c
      var safeName = escapeRegex(c.name)
      patterns.push({ key: c.key, re: new RegExp('\\b' + safeName + '\\b', 'i') })
    })
    patterns.sort(function (a, b) {
      var la = (byKey[a.key] && byKey[a.key].name || '').length
      var lb = (byKey[b.key] && byKey[b.key].name || '').length
      return lb - la
    })
    return { byKey: byKey, patterns: patterns }
  }, [champions])

  var itemByApi = useMemo(function () {
    var m = {}
    items.forEach(function (it) { if (it && it.apiName) m[it.apiName] = it })
    return m
  }, [items])

  var counts = useMemo(function () {
    var byType = {}
    var byStage = { 'Any': 0 }
    var compCount = 0
    rows.forEach(function (r) {
      var t = normalizeType(r.type)
      byType[t] = (byType[t] || 0) + 1
      var s = (r.stage || '').trim() || 'Any'
      byStage[s] = (byStage[s] || 0) + 1
      if (r.comp) compCount += 1
    })
    return { byType: byType, byStage: byStage, compCount: compCount, total: rows.length }
  }, [rows])

  var orderedTypes = useMemo(function () {
    var seen = Object.assign({}, counts.byType)
    var out = []
    TYPE_ORDER.forEach(function (t) { if (seen[t]) { out.push(t); delete seen[t] } })
    Object.keys(seen).sort().forEach(function (t) { out.push(t) })
    return out
  }, [counts])

  var orderedStages = useMemo(function () {
    var keys = Object.keys(counts.byStage)
    return keys.sort(function (a, b) {
      if (a === 'Any') return -1
      if (b === 'Any') return 1
      return Number(a) - Number(b)
    })
  }, [counts])

  var filtered = useMemo(function () {
    var q = query.trim().toLowerCase()
    return rows.filter(function (r) {
      if (typeFilter !== 'All' && normalizeType(r.type) !== typeFilter) return false
      if (stageFilter !== 'All') {
        var rowStage = (r.stage || '').trim() || 'Any'
        if (rowStage !== stageFilter) return false
      }
      if (!q) return true
      var hay = ((r.condition || '') + ' ' + (r.comp || '') + ' ' + (r.notes || '') + ' ' + (r.type || '') + ' ' + (r.stage || '')).toLowerCase()
      return hay.indexOf(q) !== -1
    })
  }, [rows, query, typeFilter, stageFilter])

  var grouped = useMemo(function () {
    var map = {}
    filtered.forEach(function (r) {
      var t = normalizeType(r.type)
      if (!map[t]) map[t] = []
      map[t].push(r)
    })
    var orderedKeys = []
    TYPE_ORDER.forEach(function (t) { if (map[t]) orderedKeys.push(t) })
    Object.keys(map).sort().forEach(function (t) {
      if (orderedKeys.indexOf(t) === -1) orderedKeys.push(t)
    })
    return orderedKeys.map(function (k) { return { type: k, rows: map[k] } })
  }, [filtered])

  function clearAll() {
    setQuery('')
    setTypeFilter('All')
    setStageFilter('All')
  }

  var hasActiveFilter = query || typeFilter !== 'All' || stageFilter !== 'All'

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>The Decision Sheet</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Line Selection</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          A clean, searchable view of the live Donut 17 prep sheet. Every condition you can roll into on stage 2 or 3, what
          comp it points at, and the units and items that make it pop.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip icon="menu_book"     label="Total Entries"  value={counts.total} />
        <StatChip icon="category"      label="Categories"     value={Object.keys(counts.byType).length} color="#67e2d9" />
        <StatChip icon="groups"        label="Comp Lines"     value={counts.compCount} color="#d9b9ff" />
        <StatChip icon="filter_list"   label="Showing"        value={filtered.length + ' / ' + counts.total} color={hasActiveFilter ? '#ff9d6b' : '#FFC66B'} />
      </div>

      <div className="d17-panel p-5 mb-8">
        <div className="flex items-center px-3 py-2 mb-4" style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255, 198, 107, 0.22)' }}>
          <span className="material-symbols-outlined mr-2" style={{ color: '#FFC66B', fontSize: 18 }}>search</span>
          <input
            type="text"
            className="bg-transparent border-none focus:ring-0 text-xs font-mono uppercase placeholder:text-outline w-full"
            style={{ color: '#E4E1EC' }}
            placeholder="SEARCH CONDITION, COMP, NOTES..."
            value={query}
            onChange={function (e) { setQuery(e.target.value) }}
          />
          {query && (
            <button
              type="button"
              onClick={function () { setQuery('') }}
              className="material-symbols-outlined cursor-pointer ml-2"
              style={{ color: '#9d8e7c', fontSize: 18 }}
              title="Clear search"
            >close</button>
          )}
        </div>

        <div className="mb-3">
          <p className="font-mono uppercase tracking-widest text-[9px] mb-2" style={{ color: '#9d8e7c' }}>Category</p>
          <div className="flex flex-wrap gap-2">
            <FilterBtn
              label="All"
              count={counts.total}
              active={typeFilter === 'All'}
              onClick={function () { setTypeFilter('All') }}
            />
            {orderedTypes.map(function (t) {
              var meta = metaFor(t)
              return (
                <FilterBtn
                  key={t}
                  label={t}
                  icon={meta.icon}
                  color={meta.color}
                  count={counts.byType[t]}
                  active={typeFilter === t}
                  onClick={function () { setTypeFilter(t) }}
                />
              )
            })}
          </div>
        </div>

        <div>
          <p className="font-mono uppercase tracking-widest text-[9px] mb-2" style={{ color: '#9d8e7c' }}>Stage</p>
          <div className="flex flex-wrap gap-2">
            <FilterBtn
              label="All Stages"
              active={stageFilter === 'All'}
              onClick={function () { setStageFilter('All') }}
            />
            {orderedStages.map(function (s) {
              return (
                <FilterBtn
                  key={s}
                  label={s === 'Any' ? 'Any' : 'Stage ' + s}
                  count={counts.byStage[s]}
                  active={stageFilter === s}
                  onClick={function () { setStageFilter(s) }}
                  color={s === 'Any' ? '#9d8e7c' : '#67e2d9'}
                />
              )
            })}
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px dashed rgba(157,142,124,0.20)' }}>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>
              Filters active
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer flex items-center gap-1.5"
              style={{ color: '#ff9d6b', border: '1px solid rgba(255,157,107,0.40)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>refresh</span>
              Reset all
            </button>
          </div>
        )}
      </div>

      {grouped.length === 0 && (
        <div className="d17-panel p-12 text-center">
          <span className="material-symbols-outlined" style={{ color: '#9d8e7c', fontSize: 40 }}>search_off</span>
          <p className="font-editorial italic text-2xl mt-4" style={{ color: '#E4E1EC' }}>No matches</p>
          <p className="font-body text-sm mt-2" style={{ color: 'rgba(228,225,236,0.55)' }}>
            Nothing in the prep sheet matches these filters. Try clearing search or pick another category.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] py-1.5 px-4 uppercase cursor-pointer mt-5 inline-flex items-center gap-1.5"
            style={{ color: '#FFC66B', border: '1px solid rgba(255,198,107,0.45)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>refresh</span>
            Reset filters
          </button>
        </div>
      )}

      {grouped.map(function (group) {
        var meta = metaFor(group.type)
        return (
          <section key={group.type} className="mb-12">
            <div className="flex items-start gap-3 mb-5">
              <div
                className="shrink-0 w-10 h-10 flex items-center justify-center"
                style={{ background: meta.color + '14', border: '1px solid ' + meta.color + '40' }}
              >
                <span className="material-symbols-outlined" style={{ color: meta.color, fontSize: 22 }}>{meta.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-editorial italic text-3xl" style={{ color: meta.color }}>{group.type}</h2>
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>
                    {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {meta.desc && (
                  <p className="font-body text-sm mt-1 leading-snug" style={{ color: 'rgba(228,225,236,0.55)' }}>
                    {meta.desc}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.rows.map(function (r) {
                return <MeetCard key={r.id} row={r} query={query} champLookup={champLookup} itemByApi={itemByApi} />
              })}
            </div>
          </section>
        )
      })}

      <p className="font-mono text-[10px] mt-10 pb-6 text-center" style={{ color: 'rgba(157, 142, 124, 0.55)' }}>
        Source: live Donut 17 prep sheet, snapshot at build time.
        Re-run <span style={{ color: '#FFC66B' }}>node scripts/meet-csv-to-json.mjs</span> to refresh.
      </p>
    </div>
  )
}
