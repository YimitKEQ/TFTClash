var TABS = [
  { k: 'opener',    label: 'Opener Advisor',  icon: 'auto_awesome' },
  { k: 'synergy',   label: 'Synergy Grid',    icon: 'grid_view' },
  { k: 'champions', label: 'Champions',       icon: 'groups' },
  { k: 'comps',     label: 'Comp Lines',      icon: 'account_tree' },
  { k: 'planner',   label: 'Team Planner',    icon: 'extension' },
  { k: 'gods',      label: 'Gods',            icon: 'temple_buddhist' },
  { k: 'items',     label: 'Items',           icon: 'inventory_2' },
  { k: 'augments',  label: 'Augments',        icon: 'diamond' },
  { k: 'meet',      label: 'Meet',            icon: 'menu_book' },
]

export default function SideNav(props) {
  var tab = props.tab
  var onTab = props.onTab

  return (
    <aside
      className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 pt-24 pb-8 z-40"
      style={{ background: '#1B1B23', borderRight: '1px solid rgba(157, 142, 124, 0.08)' }}
    >
      <div className="px-6 mb-8">
        <div className="p-4" style={{ background: '#2a2931', border: '1px solid rgba(157, 142, 124, 0.08)' }}>
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Current Set</p>
          <p className="font-editorial italic text-2xl mt-1 d17-gold-text">Space Gods</p>
          <p className="font-mono text-[10px] mt-1" style={{ color: '#9d8e7c' }}>PBE - Patch 17.x</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {TABS.map(function (t) {
          var isActive = tab === t.k
          var cls = 'flex items-center gap-4 px-6 py-3 transition-all cursor-pointer w-full text-left '
          cls += isActive
            ? 'd17-sidebar-active translate-x-0'
            : 'hover:bg-white/5'
          return (
            <button
              key={t.k}
              type="button"
              className={cls}
              style={isActive ? {} : { color: 'rgba(228,225,236,0.55)' }}
              onClick={function(){ onTab(t.k) }}
            >
              <span className="material-symbols-outlined">{t.icon}</span>
              <span className="font-label uppercase tracking-widest text-xs">{t.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="px-6 mt-6">
        <div className="p-3" style={{ background: '#0e0d15', border: '1px solid rgba(255,198,107,0.12)' }}>
          <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Isolated Tool</p>
          <p className="text-[11px] mt-1" style={{ color: 'rgba(228,225,236,0.70)' }}>Static data. No login required.</p>
        </div>
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <a
          href="/"
          className="flex items-center gap-4 px-6 py-3 hover:bg-white/5 transition-all"
          style={{ color: 'rgba(228,225,236,0.55)' }}
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label uppercase tracking-widest text-xs">Back to Clash</span>
        </a>
      </div>
    </aside>
  )
}
