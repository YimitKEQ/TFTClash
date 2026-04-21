import { useMemo, useState } from 'react'

var COMPONENTS = [
  'TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_NeedlesslyLargeRod',
  'TFT_Item_TearOfTheGoddess', 'TFT_Item_ChainVest', 'TFT_Item_NegatronCloak',
  'TFT_Item_GiantsBelt', 'TFT_Item_SparringGloves', 'TFT_Item_Spatula'
]

export default function Items(props) {
  var items = props.data.items || []
  var _s = useState('combined')
  var filter = _s[0]
  var setFilter = _s[1]

  var components = useMemo(function () {
    return items.filter(function (it) { return COMPONENTS.indexOf(it.apiName) !== -1 })
  }, [items])

  var combined = useMemo(function () {
    return items.filter(function (it) {
      return (it.from || []).length === 2 && COMPONENTS.indexOf(it.apiName) === -1 && !/emblem|radiant|ornn|shimmerscale|support|artifact/i.test(it.apiName)
    })
  }, [items])

  var artifacts = useMemo(function () {
    return items.filter(function (it) { return /artifact/i.test(it.apiName) || /artifact/i.test(it.name || '') })
  }, [items])

  var shown = filter === 'components' ? components : (filter === 'artifacts' ? artifacts : combined)

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>The Forge</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Items</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Components, combined items, and artifacts. Click any item for effects and recipe.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterBtn v="combined"   l="Combined"   current={filter} set={setFilter}/>
        <FilterBtn v="components" l="Components" current={filter} set={setFilter}/>
        <FilterBtn v="artifacts"  l="Artifacts"  current={filter} set={setFilter}/>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {shown.map(function (it) {
          return (
            <div key={it.apiName} className="d17-panel p-3 text-center group cursor-default">
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
              <p className="font-editorial italic text-xs mt-2" style={{ color: '#FFC66B' }}>{it.name}</p>
              <p className="text-[10px] mt-1 leading-snug line-clamp-3 hidden group-hover:block font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>
                {stripHtml(it.desc)}
              </p>
            </div>
          )
        })}
        {shown.length === 0 && (
          <div className="col-span-full d17-panel p-8 text-center font-mono text-sm" style={{ color: '#9d8e7c' }}>
            NO ITEMS IN THIS CATEGORY
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
