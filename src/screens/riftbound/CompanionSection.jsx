import { Panel, Icon } from '../../components/ui'

var FEATURES = [
  { icon: 'scoreboard', title: 'Full scoring engine', desc: 'Conquer and Hold points, the final-point rule, and victory detection for 1v1, 2v2, and free-for-all with 3 or 4 players.' },
  { icon: 'diamond', title: 'Rune economy', desc: 'Track channeled, ready, and exhausted runes plus floating Energy and Power per domain. Pools clear automatically at end of turn.' },
  { icon: 'swords', title: 'Combat math', desc: 'Units carry their real Might, buffs, temporary boosts, and damage. Tanks, stuns, and lethal checks are handled for you.' },
  { icon: 'flag', title: 'Battlefield control', desc: 'Contested states, per-turn scoring locks, and conquer buttons that follow the actual rules, including the draw-instead final point.' },
  { icon: 'undo', title: '200-step undo', desc: 'Every tap goes through one undo stack. Misclicked mid-combat? Step straight back. Games auto-save on the device.' },
  { icon: 'style', title: 'Every real card', desc: 'The full card database is embedded: search any unit, legend, or battlefield and it appears with its art, stats, and rules text.' },
]

export default function CompanionSection() {
  return (
    <div className="space-y-6">
      {/* Launch hero */}
      <Panel padding="spacious" className="relative overflow-hidden text-center">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-tertiary/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <Icon name="table_restaurant" size={40} className="text-tertiary block mx-auto mb-3" />
          <h3 className="font-display text-2xl md:text-3xl text-on-surface mb-2">Table Companion</h3>
          <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-xl mx-auto mb-6">
            A full game-table assistant for playing Riftbound in person. Your physical cards stay the source of truth; the companion handles every piece of bookkeeping: points, runes, battlefields, combat, phases. Built for iPad at the table, works on any phone or laptop.
          </p>
          <a
            href="/riftbound/companion.html"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-tertiary text-on-tertiary font-label font-bold text-sm uppercase tracking-widest rounded-full hover:brightness-110 transition-all no-underline"
          >
            <Icon name="play_circle" size={20} aria-hidden="true" />
            Launch Companion
          </a>
          <p className="text-[11px] text-on-surface-variant/45 mt-3">Opens fullscreen in a new tab. Works offline once loaded.</p>
        </div>
      </Panel>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(function(f) {
          return (
            <Panel key={f.title} padding="default">
              <div className="w-9 h-9 rounded-lg bg-tertiary/10 border border-tertiary/25 flex items-center justify-center mb-3">
                <Icon name={f.icon} size={18} className="text-tertiary" />
              </div>
              <h4 className="font-display text-sm text-on-surface mb-1.5">{f.title}</h4>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">{f.desc}</p>
            </Panel>
          )
        })}
      </div>

      {/* Install instructions */}
      <Panel padding="spacious">
        <h4 className="font-display text-base text-on-surface mb-3">Put it on your home screen</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="font-label text-[10px] uppercase tracking-widest text-tertiary mb-1.5">iPad and iPhone</div>
            <ol className="space-y-1.5 text-xs text-on-surface-variant/75 leading-relaxed list-decimal list-inside">
              <li>Open the companion in Safari</li>
              <li>Tap the Share button</li>
              <li>Tap Add to Home Screen</li>
            </ol>
          </div>
          <div>
            <div className="font-label text-[10px] uppercase tracking-widest text-tertiary mb-1.5">Android and desktop</div>
            <ol className="space-y-1.5 text-xs text-on-surface-variant/75 leading-relaxed list-decimal list-inside">
              <li>Open the companion in Chrome or Edge</li>
              <li>Use the Install App option in the browser menu</li>
            </ol>
          </div>
        </div>
        <p className="text-[11px] text-on-surface-variant/45 mt-4 leading-relaxed">
          Installed, it launches fullscreen with no browser chrome, keeps the screen awake during games, caches itself for offline use, and saves your game on the device so an accidental close never loses the score.
        </p>
      </Panel>
    </div>
  )
}
