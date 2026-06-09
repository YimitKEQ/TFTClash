import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import { DISCORD_URL } from '../lib/constants.js'

// ─── DATA ─────────────────────────────────────────────────────────────────────

var PILLARS = [
  {
    icon: 'target',
    label: 'Win Condition',
    title: 'Stage 3 Wins Lobbies',
    desc: 'Every choice on Stage 2 exists to set up one thing: a strong, two-starred board the moment Stage 3 begins.',
  },
  {
    icon: 'savings',
    label: 'Tempo',
    title: 'Board Over Gold',
    desc: 'Units are loaded with power early. Holding the right pairs beats hitting your gold interval one round sooner.',
  },
  {
    icon: 'visibility',
    label: 'Information',
    title: 'Scout Every Turn',
    desc: 'What to play, when to level, how to position. Every question on the board is answered by a five-second scout.',
  },
]

var LESSONS = [
  {
    id: 'stage3',
    num: '01',
    eyebrow: 'The core idea',
    title: 'Stage 3 Is The Whole Game',
    lede: 'Stop treating Stage 2 like a race. Treat it like setup. If you walk into Stage 3 strong, almost nothing you did before it matters.',
    points: [
      'Stop leveling on Stage 2 just because you can. A level you do not need is gold and HP you will want for your Stage 3 board.',
      'Stop forcing a flawless win or loss streak. Mixed streaking is completely fine as long as Stage 3 is yours.',
      'Hold the units that build your strongest Stage 3 line, even pairs you are not playing yet, instead of selling for a slightly earlier interval.',
    ],
    take: 'It is okay to mix-streak Stage 2, as long as you win Stage 3.',
  },
  {
    id: 'tengold',
    num: '02',
    eyebrow: 'Early game',
    title: 'Do Not Rush Your First 10 Gold',
    lede: 'The old habit of selling everything to hit 10 gold as fast as possible is outdated. Modern units do too much damage to throw away for one extra round of interest.',
    points: [
      'Hold strong openers and connectors instead of dumping them for an early interval. A held pair often out-values the gold you would have banked.',
      'You make gold by winning. A clean win streak pays better than an early interest break and keeps your HP bar full.',
      'Aim to reach the 10 gold threshold by the first carousel at the latest. Delaying it a round or two to keep a strong board is a good trade.',
    ],
    take: 'A strong board prints gold. An empty bench at 10 gold does not.',
  },
  {
    id: 'lossstreak',
    num: '03',
    eyebrow: 'Streak myths',
    title: 'The Perfect Loss Streak Is A Trap',
    lede: 'Giga open-forting for a flawless five-loss streak pays far less than it used to. Unless your comp is built to lose on purpose, it is rarely the right plan.',
    points: [
      'The gold from a deep loss streak was cut down sets ago. The HP you burn to chase it is no longer worth the payout.',
      'Hold your units, take the soft three-loss, and keep your board healthy instead of intentionally fielding nothing.',
      'If your board feels strong after the first carousel, flip it. Win the next two and roll into Krugs with tempo instead of bleeding out.',
    ],
    take: 'Loss-streak on purpose only with a loss-streak comp. Otherwise, hold and pivot.',
  },
  {
    id: 'augments',
    num: '04',
    eyebrow: 'Augments',
    title: 'Take Tempo, Not Always Econ',
    lede: 'The classic "one econ, one item, one combat" is a fine baseline, but the order matters less than the spot you are in. When you have a strong opener, lean into tempo.',
    points: [
      'Good start with a direction and a two-star? Favor item and combat augments. Early items mean early damage, which means a win streak that funds itself.',
      'Homeless with no pairs and no plan? That is when econ first makes sense. Bank gold, scout the uncontested line, and hold toward a strong Stage 3.',
      'The 4-2 augment is your natural econ window if you might not hit. After streaking on tempo augments, econ here lets you stabilize and push level 9.',
    ],
    take: 'Strong opener favors item and combat. Take econ when you are lost, or save it for 4-2.',
  },
  {
    id: 'scout',
    num: '05',
    eyebrow: 'The free LP',
    title: 'Scout Every Single Turn',
    lede: 'This is the most boring advice in TFT and the reason most people are stuck. Every decision you agonize over is already answered on someone else’s board.',
    points: [
      'What do I play? Scout the lobby and find the line nobody else is contesting.',
      'Do I level here? Scout the boards you are about to fight and check if leveling actually changes the result.',
      'How do I position? Scout your next opponent and place against their board, not against a memory of last round.',
    ],
    take: 'You can climb a full rank just by scouting before every single fight.',
  },
]

var CHECKLIST = [
  { stage: '2-1', note: 'Keep strong pairs and connectors. Do not over-level. Take a tempo augment if your start is good.' },
  { stage: '2-3', note: 'Hit 10 gold by the first carousel at the latest. Win-streak if the board allows it.' },
  { stage: '3-2', note: 'This is the fight that matters. Be two-starred and strong. Lean item or combat again unless you are losing anyway.' },
  { stage: '4-2', note: 'Your econ window. Stabilize, roll if you need the board, and set up the climb to level 9.' },
  { stage: 'Every turn', note: 'Scout. Then position your tank in front of their carry.' },
]

// Interest: one gold per ten in the bank, capped at five.
var INTEREST = [
  { gold: '10', bonus: '+1' },
  { gold: '20', bonus: '+2' },
  { gold: '30', bonus: '+3' },
  { gold: '40', bonus: '+4' },
  { gold: '50', bonus: '+5' },
]

// A default leveling cadence. Reroll boards ignore this on purpose.
var LEVEL_MAP = [
  { stage: '2-1', move: 'Level 4', detail: 'Open your board. Do not roll yet.' },
  { stage: '2-5', move: 'Level 5', detail: 'A little board strength before Krugs.' },
  { stage: '3-2', move: 'Level 6', detail: 'First real power spike. Stabilize here.' },
  { stage: '4-1', move: 'Level 7', detail: 'Standard comps level on the way to 8.' },
  { stage: '4-5', move: 'Level 8', detail: 'The main rolldown for most boards. Hit your units.' },
  { stage: '6-1', move: 'Level 9', detail: 'Once stable, push for the top-end carries.' },
]

// Real component icons live in public/guide/components, pulled from official assets.
var COMPONENTS = [
  { file: 'bfsword', name: 'B.F. Sword' },
  { file: 'recurvebow', name: 'Recurve Bow' },
  { file: 'rod', name: 'Needlessly Large Rod' },
  { file: 'tear', name: 'Tear of the Goddess' },
  { file: 'chainvest', name: 'Chain Vest' },
  { file: 'negatron', name: 'Negatron Cloak' },
  { file: 'giantsbelt', name: "Giant's Belt" },
  { file: 'gloves', name: 'Sparring Gloves' },
]

var ARCHETYPES = [
  {
    icon: 'trending_up',
    name: 'Standard Tempo',
    desc: 'Strong board, level on cadence, roll down at 4-1 or 4-5 for a level 8 board. Your default when no strong signal points elsewhere.',
  },
  {
    icon: 'rocket_launch',
    name: 'Fast 8',
    desc: 'Trade early econ to rush level 8 and high-cost carries. Needs a healthy HP bar and econ augments to fund it.',
  },
  {
    icon: 'casino',
    name: 'Reroll',
    desc: 'Slow-roll at level 6 or 7 to three-star key low-cost units. Commit early, hold every pair, and do not level past your breakpoint.',
  },
]

// ─── POSITIONING DIAGRAM ────────────────────────────────────────────────────

// A simplified two-team board. Rows 0-1 are the enemy, rows 2-3 are you.
// We highlight four cells to teach the one positioning rule that matters most.
var BOARD_ROWS = 4
var BOARD_COLS = 7

var HIGHLIGHTS = {
  '0-4': { kind: 'enemyCarry', label: 'Their carry' },
  '1-4': { kind: 'enemyTank', label: 'Their tank' },
  '2-4': { kind: 'yourTank', label: 'Your tank' },
  '3-1': { kind: 'yourCarry', label: 'Your carry' },
}

var CELL_STYLES = {
  enemyCarry: 'bg-error/80 border-error',
  enemyTank: 'bg-error/30 border-error/50',
  yourTank: 'bg-tertiary/80 border-tertiary',
  yourCarry: 'bg-secondary/80 border-secondary',
}

function HexCell(props) {
  var hl = props.hl
  var isEnemy = props.rowIndex < 2
  var base = 'aspect-square border transition-colors'
  var fill = hl
    ? CELL_STYLES[hl.kind]
    : isEnemy
      ? 'bg-error/[0.04] border-error/10'
      : 'bg-tertiary/[0.04] border-tertiary/10'
  return (
    <div
      className={base + ' ' + fill}
      style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
    />
  )
}

function PositioningBoard() {
  var rows = []
  var r = 0
  for (r = 0; r < BOARD_ROWS; r++) {
    var cells = []
    var c = 0
    for (c = 0; c < BOARD_COLS; c++) {
      var key = r + '-' + c
      cells.push(<HexCell key={key} hl={HIGHLIGHTS[key]} rowIndex={r} />)
    }
    // Offset alternate rows for the hex-grid look.
    var offset = r % 2 === 1 ? 'ml-[7%]' : ''
    rows.push(
      <div key={'row-' + r} className={'grid gap-1.5 ' + offset} style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-error/70 font-bold">Enemy side</span>
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-tertiary/70 font-bold">Your side</span>
      </div>
      <div className="space-y-1.5 mb-6">{rows}</div>
      <div className="grid grid-cols-2 gap-3">
        <LegendDot kind="yourTank" text="Tank in front of their carry" />
        <LegendDot kind="yourCarry" text="Carry in the far corner" />
        <LegendDot kind="enemyCarry" text="Their main damage" />
        <LegendDot kind="enemyTank" text="Their frontline" />
      </div>
    </div>
  )
}

function LegendDot(props) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={'w-3 h-3 flex-shrink-0 border ' + CELL_STYLES[props.kind]}
        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
      />
      <span className="font-body text-xs text-slate-400 leading-tight">{props.text}</span>
    </div>
  )
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function GuideScreen() {
  var [openId, setOpenId] = useState('stage3')

  function toggle(id) {
    setOpenId(function (prev) { return prev === id ? null : id })
  }

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-16">

        {/* Hero */}
        <div className="mb-14">
          <span className="font-label text-primary uppercase tracking-[0.2em] text-sm mb-3 block">
            TFT Clash Academy
          </span>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-on-surface leading-[0.95] mb-5">
            How To Climb
          </h1>
          <p className="font-body text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
            No tier lists, no copy-paste comps. Five habits that move you from hardstuck to
            consistent, drawn from how top ladder players actually think about a game.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PILLARS.map(function (p) {
            return (
              <Panel key={p.label} padding="spacious" className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                  <Icon name={p.icon} size={80} />
                </div>
                <h3 className="font-label text-primary uppercase tracking-widest text-xs font-bold mb-4">
                  {p.label}
                </h3>
                <p className="font-display text-2xl font-bold text-on-surface mb-2 leading-tight">
                  {p.title}
                </p>
                <p className="font-body text-slate-400 text-sm leading-relaxed">
                  {p.desc}
                </p>
              </Panel>
            )
          })}
        </div>

        {/* Core principle band */}
        <div className="mb-20">
          <Panel padding="spacious" radius="xl" accent="gold" className="relative overflow-hidden">
            <div className="md:flex items-center gap-8">
              <div className="flex-shrink-0 mb-5 md:mb-0">
                <div className="w-16 h-16 rounded-xl bg-primary/15 flex items-center justify-center">
                  <span className="text-primary"><Icon name="bolt" size={34} /></span>
                </div>
              </div>
              <div>
                <span className="font-label text-primary/80 uppercase tracking-widest text-xs font-bold mb-2 block">
                  If you remember one thing
                </span>
                <p className="font-display text-2xl md:text-4xl font-bold text-on-surface leading-tight">
                  Stage 2 is setup. Stage 3 is the game.
                </p>
                <p className="font-body text-slate-400 text-sm md:text-base mt-3 max-w-2xl leading-relaxed">
                  Build every early decision around one goal: arriving at Stage 3 with a strong,
                  two-starred board. Get that right and the rest of the game forgives a lot of mistakes.
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Lessons + positioning */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left: numbered lessons */}
          <div className="lg:col-span-7">
            <h2 className="font-display text-3xl font-bold text-on-surface mb-2">The Five Habits</h2>
            <p className="font-body text-slate-500 text-sm mb-8">Tap any habit to open it.</p>

            <div className="space-y-4">
              {LESSONS.map(function (l) {
                var isOpen = openId === l.id
                return (
                  <Panel
                    key={l.id}
                    padding="none"
                    className={'overflow-hidden' + (isOpen ? ' border border-primary/30' : '')}
                  >
                    <button
                      onClick={function () { toggle(l.id) }}
                      className={'w-full flex items-start gap-4 p-6 text-left transition-all' + (isOpen ? ' bg-white/5' : ' hover:bg-white/5')}
                    >
                      <span className="font-display text-2xl font-bold text-primary/60 leading-none pt-0.5">{l.num}</span>
                      <span className="flex-1">
                        <span className="font-label text-secondary uppercase tracking-widest text-[10px] font-bold block mb-1">
                          {l.eyebrow}
                        </span>
                        <span className="font-display text-xl font-bold text-on-surface leading-tight block">
                          {l.title}
                        </span>
                      </span>
                      <span className={'transition-colors flex-shrink-0 ' + (isOpen ? 'text-primary' : 'text-slate-500')}>
                        <Icon name={isOpen ? 'remove' : 'add'} size={22} />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-7 pt-1">
                        <p className="font-body text-slate-300 text-sm leading-relaxed mb-5">{l.lede}</p>
                        <ul className="space-y-3 mb-6">
                          {l.points.map(function (pt, i) {
                            return (
                              <li key={i} className="flex items-start gap-3">
                                <span className="text-tertiary flex-shrink-0 pt-0.5">
                                  <Icon name="chevron_right" size={16} />
                                </span>
                                <span className="font-body text-slate-400 text-sm leading-relaxed">{pt}</span>
                              </li>
                            )
                          })}
                        </ul>
                        <div className="flex items-start gap-3 rounded-lg bg-primary/[0.07] border border-primary/20 px-4 py-3">
                          <span className="text-primary flex-shrink-0 pt-0.5"><Icon name="push_pin" size={16} /></span>
                          <span className="font-body text-sm text-on-surface italic leading-relaxed">{l.take}</span>
                        </div>
                      </div>
                    )}
                  </Panel>
                )
              })}
            </div>
          </div>

          {/* Right: positioning diagram + checklist */}
          <div className="lg:col-span-5 space-y-6">

            <Panel padding="spacious" radius="xl" glass className="lg:sticky lg:top-24">
              <span className="font-label text-tertiary uppercase tracking-widest text-xs font-bold mb-1 block">
                The one positioning rule
              </span>
              <p className="font-display text-xl font-bold text-on-surface mb-5 leading-tight">
                Tank in front of their carry
              </p>
              <PositioningBoard />
              <p className="font-body text-slate-400 text-xs leading-relaxed mt-6">
                Your tank soaks the enemy carry so the rest of your team survives. Your carry sits in
                the opposite corner, as far from their frontline as possible. If you do nothing else,
                do this every fight.
              </p>
            </Panel>

            <Panel padding="spacious" radius="xl">
              <span className="font-label text-secondary uppercase tracking-widest text-xs font-bold mb-5 block">
                The 60-second version
              </span>
              <ul className="space-y-4">
                {CHECKLIST.map(function (c) {
                  return (
                    <li key={c.stage} className="flex items-start gap-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/[0.12] rounded px-2 py-1 flex-shrink-0 min-w-[3.25rem] text-center">
                        {c.stage}
                      </span>
                      <span className="font-body text-sm text-slate-400 leading-relaxed pt-0.5">{c.note}</span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>
        </div>

        {/* Deeper mechanics */}
        <div className="mt-24">
          <div className="mb-8">
            <span className="font-label text-tertiary uppercase tracking-[0.2em] text-sm mb-2 block">
              The numbers behind the habits
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-on-surface">Deeper Mechanics</h2>
            <p className="font-body text-slate-500 text-sm mt-2 max-w-2xl leading-relaxed">
              Learn these once and they stop being decisions you agonize over mid-game.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Econ & interest */}
            <Panel padding="spacious" radius="xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-primary"><Icon name="savings" size={22} /></span>
                <h3 className="font-display text-xl font-bold text-on-surface">Econ &amp; Interest</h3>
              </div>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-6">
                You earn one bonus gold for every ten you keep in the bank, up to five. Hitting the
                next breakpoint is often worth more than a single reroll.
              </p>
              <div className="grid grid-cols-5 gap-2 mb-6">
                {INTEREST.map(function (b) {
                  return (
                    <div key={b.gold} className="rounded-lg bg-primary/[0.07] border border-primary/15 px-2 py-3 text-center">
                      <div className="font-mono text-sm font-bold text-on-surface">{b.gold}g</div>
                      <div className="font-mono text-xs text-primary mt-1">{b.bonus}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-tertiary/[0.07] border border-tertiary/15 px-4 py-3">
                <span className="text-tertiary flex-shrink-0 pt-0.5"><Icon name="local_fire_department" size={16} /></span>
                <span className="font-body text-sm text-slate-300 leading-relaxed">
                  A win or loss streak pays on top of interest: roughly one gold at a 2 to 3 streak,
                  two at four, and three once you hit five. Streaking is where your real gold comes from.
                </span>
              </div>
            </Panel>

            {/* Leveling cadence */}
            <Panel padding="spacious" radius="xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-secondary"><Icon name="stairs" size={22} /></span>
                <h3 className="font-display text-xl font-bold text-on-surface">Leveling Cadence</h3>
              </div>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-5">
                A safe default map. Adjust it to your board, and ignore it entirely when you are rerolling.
              </p>
              <ul className="space-y-3">
                {LEVEL_MAP.map(function (lv) {
                  return (
                    <li key={lv.stage} className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-secondary bg-secondary/[0.12] rounded px-2 py-1 flex-shrink-0 min-w-[2.75rem] text-center">
                        {lv.stage}
                      </span>
                      <span className="font-display text-sm font-bold text-on-surface flex-shrink-0 min-w-[4.5rem]">{lv.move}</span>
                      <span className="font-body text-xs text-slate-400 leading-snug">{lv.detail}</span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>

          {/* Item components */}
          <Panel padding="spacious" radius="xl" className="mb-6">
            <div className="md:flex items-start justify-between gap-8">
              <div className="md:max-w-xs mb-6 md:mb-0 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-primary"><Icon name="construction" size={22} /></span>
                  <h3 className="font-display text-xl font-bold text-on-surface">The 8 Components</h3>
                </div>
                <p className="font-body text-slate-400 text-sm leading-relaxed">
                  Any two of these combine into a finished item. Do not hoard components hoping for the
                  perfect build. Slam a strong item early so your carry does damage now, while it matters.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-x-4 gap-y-5 flex-1">
                {COMPONENTS.map(function (c) {
                  return (
                    <div key={c.file} className="flex flex-col items-center text-center gap-2">
                      <img
                        src={'/guide/components/' + c.file + '.png'}
                        alt={c.name}
                        loading="lazy"
                        className="w-12 h-12 md:w-14 md:h-14 rounded-md ring-1 ring-white/10"
                      />
                      <span className="font-label text-[10px] uppercase tracking-wide text-slate-400 leading-tight">{c.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Panel>

          {/* Archetypes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ARCHETYPES.map(function (a) {
              return (
                <Panel key={a.name} padding="spacious" className="relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.08] group-hover:opacity-[0.16] transition-opacity pointer-events-none">
                    <Icon name={a.icon} size={64} />
                  </div>
                  <span className="text-tertiary mb-3 block"><Icon name={a.icon} size={26} /></span>
                  <h4 className="font-display text-lg font-bold text-on-surface mb-2">{a.name}</h4>
                  <p className="font-body text-slate-400 text-sm leading-relaxed">{a.desc}</p>
                </Panel>
              )
            })}
          </div>
        </div>

        {/* Closing CTA */}
        <div className="mt-20">
          <Panel padding="spacious" radius="xl" className="text-center relative overflow-hidden">
            <h3 className="font-display text-3xl md:text-4xl font-bold text-on-surface mb-3">
              Now go put it on the board.
            </h3>
            <p className="font-body text-slate-400 text-sm md:text-base max-w-xl mx-auto mb-7 leading-relaxed">
              Reading is the easy part. Pick one habit, force yourself to do it every game this week,
              then come prove it in a Clash.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Btn variant="primary" size="md" icon="swords" href="/clash">Find a Clash</Btn>
              <Btn variant="tertiary" size="md" icon="forum" href={DISCORD_URL}>Talk theory in Discord</Btn>
            </div>
          </Panel>
        </div>

        <p className="font-body text-xs text-slate-600 text-center mt-10 leading-relaxed max-w-xl mx-auto">
          Fundamentals shared in the spirit of the TFT community. What works in a given patch
          changes; the habits do not.
        </p>

      </div>
    </PageLayout>
  )
}
