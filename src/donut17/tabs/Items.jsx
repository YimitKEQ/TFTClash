import { useMemo, useState } from 'react'

var COMPONENTS = [
  'TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_NeedlesslyLargeRod',
  'TFT_Item_TearOfTheGoddess', 'TFT_Item_ChainVest', 'TFT_Item_NegatronCloak',
  'TFT_Item_GiantsBelt', 'TFT_Item_SparringGloves', 'TFT_Item_Spatula'
]

// Combined items live under TFT_Item_* but exclude debug, grant, hex, artifact, components.
function isCombined(it) {
  var n = it.apiName || ''
  if (!/^TFT_Item_/.test(n)) return false
  if (COMPONENTS.indexOf(n) !== -1) return false
  if (/Artifact|Hex_|Grant|Debug|Tactician|ThiefsGloves|^TFT_Item_Emblem/i.test(n)) return false
  return true
}

function isArtifact(it) {
  return /_Artifact_/i.test(it.apiName || '')
}

export default function Items(props) {
  var items = props.data.items || []
  var _s = useState('combined')
  var filter = _s[0]
  var setFilter = _s[1]

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var _sel = useState(null)
  var selected = _sel[0]
  var setSelected = _sel[1]

  var components = useMemo(function () {
    return items.filter(function (it) { return COMPONENTS.indexOf(it.apiName) !== -1 })
  }, [items])

  var combined = useMemo(function () {
    return items.filter(isCombined).sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [items])

  var artifacts = useMemo(function () {
    return items.filter(isArtifact).sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [items])

  var pool = filter === 'components' ? components : (filter === 'artifacts' ? artifacts : combined)

  var shown = useMemo(function () {
    if (!query) return pool
    var q = query.toLowerCase()
    return pool.filter(function (it) { return (it.name || '').toLowerCase().indexOf(q) !== -1 })
  }, [pool, query])

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>The Forge</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Items</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Components, combined items, and artifacts. Tap any item to read its full effect.
        </p>
      </header>

      <div className="d17-panel p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex flex-wrap gap-2">
          <FilterBtn v="combined"   l={'Combined (' + combined.length + ')'}     current={filter} set={setFilter}/>
          <FilterBtn v="components" l={'Components (' + components.length + ')'} current={filter} set={setFilter}/>
          <FilterBtn v="artifacts"  l={'Artifacts (' + artifacts.length + ')'}   current={filter} set={setFilter}/>
        </div>
        <input
          className="flex-1 min-w-[240px] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider"
          style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
          placeholder="SEARCH ITEM..."
          type="text"
          value={query}
          onChange={function(e){ setQuery(e.target.value) }}
        />
      </div>

      {selected && (
        <div className="d17-panel p-5 mb-6" style={{ borderLeft: '3px solid #FFC66B' }}>
          <div className="flex items-start gap-4">
            {selected.icon ? (
              <img alt={selected.name} src={selected.icon} className="w-16 h-16 shrink-0" style={{ border: '1px solid rgba(255,198,107,0.32)' }}/>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-editorial italic text-2xl" style={{ color: '#FFC66B' }}>{selected.name}</p>
                <button
                  type="button"
                  onClick={function(){ setSelected(null) }}
                  className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer"
                  style={{ color: 'rgba(228,225,236,0.55)', border: '1px solid rgba(157,142,124,0.25)' }}
                >Close</button>
              </div>
              <p className="text-sm mt-3 leading-relaxed font-body" style={{ color: 'rgba(228,225,236,0.78)' }}>
                {stripHtml(selected.desc) || 'No effect text available.'}
              </p>
              {selected.effects && Object.keys(selected.effects).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.keys(selected.effects).filter(function (k) { return !/^\{/.test(k) }).slice(0, 8).map(function (k) {
                    var v = selected.effects[k]
                    if (v == null) return null
                    return (
                      <span
                        key={k}
                        className="font-mono text-[10px] px-2 py-1 uppercase tracking-wide"
                        style={{ background: 'rgba(255,198,107,0.10)', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.22)' }}
                      >{k}: {typeof v === 'number' ? Number(v).toFixed(2).replace(/\.00$/, '') : String(v)}</span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {shown.map(function (it) {
          var isSel = selected && selected.apiName === it.apiName
          return (
            <button
              type="button"
              key={it.apiName}
              onClick={function(){ setSelected(isSel ? null : it) }}
              className="d17-panel p-3 text-center cursor-pointer transition-colors"
              style={{
                borderColor: isSel ? 'rgba(255,198,107,0.55)' : undefined,
                background: isSel ? 'rgba(255,198,107,0.06)' : undefined
              }}
            >
              {it.icon ? (
                <img
                  alt={it.name}
                  src={it.icon}
                  onError={function(e){ e.target.style.display='none' }}
                  className="w-14 h-14 mx-auto"
                  style={{ border: '1px solid rgba(255,198,107,0.18)' }}
                />
              ) : (
                <div className="w-14 h-14 mx-auto" style={{ background: '#0e0d15', border: '1px solid #504535' }}/>
              )}
              <p className="font-editorial italic text-xs mt-2 truncate" style={{ color: isSel ? '#FFC66B' : 'rgba(228,225,236,0.85)' }}>{it.name}</p>
            </button>
          )
        })}
        {shown.length === 0 && (
          <div className="col-span-full d17-panel p-8 text-center font-mono text-sm" style={{ color: '#9d8e7c' }}>
            NO ITEMS MATCH THESE FILTERS
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
  var active = props.current === props.v
  return (
    <button
      type="button"
      onClick={function(){ props.set(props.v) }}
      className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer"
      style={{
        background: active ? 'rgba(255,198,107,0.10)' : 'transparent',
        color: active ? '#FFC66B' : 'rgba(228,225,236,0.55)',
        border: active ? '1px solid rgba(255,198,107,0.40)' : '1px solid rgba(157,142,124,0.15)'
      }}
    >{props.l}</button>
  )
}
