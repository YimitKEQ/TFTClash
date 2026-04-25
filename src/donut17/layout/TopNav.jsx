import { useState } from 'react'

export default function TopNav(props) {
  var tab = props.tab
  var onTab = props.onTab
  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  return (
    <nav
      className="flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50"
      style={{
        background: 'rgba(19, 19, 26, 0.85)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 1px 0 rgba(255, 198, 107, 0.10), 0 20px 40px rgba(0,0,0,0.25)'
      }}
    >
      <div className="flex items-center gap-10">
        <div className="flex items-baseline gap-2">
          <span className="d17-wordmark text-2xl font-black tracking-tighter">DONUT 17</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface/40">SPACE GODS</span>
        </div>

        <div className="hidden md:flex gap-6 items-center">
          <TopLink label="Opener"    k="opener"   tab={tab} onTab={onTab}/>
          <TopLink label="Champs"    k="champions"tab={tab} onTab={onTab}/>
          <TopLink label="Team Comps" k="comps"   tab={tab} onTab={onTab}/>
          <TopLink label="Lines"     k="meet"     tab={tab} onTab={onTab}/>
          <TopLink label="Planner"   k="planner"  tab={tab} onTab={onTab}/>
          <TopLink label="Gods"      k="gods"     tab={tab} onTab={onTab}/>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div
          className="hidden lg:flex items-center px-3 py-2"
          style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255, 198, 107, 0.20)' }}
        >
          <span className="material-symbols-outlined text-primary text-sm mr-2">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-xs font-mono placeholder:text-outline w-48 uppercase"
            placeholder="SEARCH UNITS..."
            type="text"
            value={query}
            onChange={function(e){ setQuery(e.target.value); if(props.onSearch) props.onSearch(e.target.value); }}
          />
        </div>
        <a
          className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors opacity-70"
          href="/"
          title="Exit to TFT Clash"
        >exit_to_app</a>
      </div>
    </nav>
  )
}

function TopLink(props) {
  var active = props.tab === props.k
  var base = 'font-label uppercase tracking-wider text-xs pb-1 transition-all cursor-pointer '
  var on = active
    ? 'text-[#FFC66B] border-b-2 border-[#FFC66B] font-bold'
    : 'text-[#E4E1EC] opacity-70 hover:opacity-100 border-b-2 border-transparent'
  return (
    <button
      type="button"
      className={base + on}
      onClick={function(){ props.onTab(props.k) }}
    >{props.label}</button>
  )
}
