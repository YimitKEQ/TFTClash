import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon } from '../components/ui'

// Public changelog. Static. Add new entries at the top.
// Categories: feat / fix / perf / chore.

var CHANGELOG = [
  {
    date: "2026-04-25",
    items: [
      { type: "feat",  text: "Bracket auto-advance race guard. Top-of-game 0 transitions are now atomic." },
      { type: "feat",  text: "Per-region tournament_state slot. EU + NA can run concurrent clashes." },
      { type: "fix",   text: "Bracket double-count: snapshot pattern keeps DB and React in lockstep." },
      { type: "fix",   text: "Cut line cuts again. Standings now build from clashHistory directly." },
      { type: "fix",   text: "Bonus points now persist to DB and survive unlock cycles." },
      { type: "chore", text: "Hard-purged Levitate clash test data from production." }
    ]
  },
  {
    date: "2026-04-22",
    items: [
      { type: "feat",  text: "Brosephtech ops board: comments, templates, standup view, bottleneck heatmap." },
      { type: "feat",  text: "Multi-assignee + subtask support on cards." },
      { type: "feat",  text: "Stale-card detection." }
    ]
  },
  {
    date: "2026-04-20",
    items: [
      { type: "feat",  text: "Glassmorphism redesign: orb field background, frosted UI primitives." },
      { type: "feat",  text: "Real crew widget, workload meter, patch war room, idea FAB." }
    ]
  },
  {
    date: "2026-04-06",
    items: [
      { type: "feat",  text: "JARVIS Command Center: 6-tab admin rebuild." },
      { type: "feat",  text: "Public-launch security hardening across players, sponsors, audit_log." },
      { type: "fix",   text: "Player profile stale ref crash on rapid nav." }
    ]
  },
  {
    date: "2026-04-05",
    items: [
      { type: "feat",  text: "PayPal subscription pivot: full 5-tier integration with webhook." },
      { type: "feat",  text: "Pricing page rebuilt around the real tier matrix." }
    ]
  },
  {
    date: "2026-04-03",
    items: [
      { type: "feat",  text: "Sponsor system shipped: admin tab, public showcase, RLS lockdown." },
      { type: "fix",   text: "Bracket lobby-grouped results, HOST badge, Riot ID copy." }
    ]
  }
]

var TYPE_META = {
  feat:  { label: "feat",  cls: "bg-primary/10 text-primary border-primary/30",       icon: "spark" },
  fix:   { label: "fix",   cls: "bg-success/10 text-success border-success/30",       icon: "build" },
  perf:  { label: "perf",  cls: "bg-tertiary/10 text-tertiary border-tertiary/30",    icon: "speed" },
  chore: { label: "chore", cls: "bg-on-surface/10 text-on-surface-variant border-on-surface/20", icon: "settings" }
}

function TypePill(props) {
  var meta = TYPE_META[props.type] || TYPE_META.chore
  return (
    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-label uppercase tracking-widest " + meta.cls}>
      {meta.label}
    </span>
  )
}

export default function ChangelogScreen() {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto pt-8 pb-16">
        <div className="mb-10">
          <span className="font-label text-xs uppercase tracking-widest text-secondary">What's new</span>
          <h1 className="font-editorial text-4xl md:text-5xl mt-2 text-on-surface">Changelog</h1>
          <p className="text-on-surface-variant mt-3 max-w-xl">
            Public log of every shipped feature, fix, and tweak. Newest at the top.
          </p>
        </div>
        <div className="space-y-8">
          {CHANGELOG.map(function (group) {
            return (
              <Panel key={group.date} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Icon name="calendar_today" className="text-secondary" />
                  <span className="font-mono text-sm text-on-surface-variant">{group.date}</span>
                </div>
                <ul className="space-y-3">
                  {group.items.map(function (it, i) {
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex-shrink-0"><TypePill type={it.type} /></span>
                        <span className="text-on-surface text-sm leading-relaxed">{it.text}</span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )
          })}
        </div>
      </div>
    </PageLayout>
  )
}
