import { useState, useEffect } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import { DISCORD_URL } from '../lib/constants.js'
import PositioningBoard from './guide/PositioningBoard'
import CompShowcase from './guide/CompShowcase'
import {
  CHAPTERS, PRINCIPLES, LESSONS, INTEREST, SHOP_ODDS, SHOP_ODDS_COLS, ODDS_NOTES,
  LEVEL_MAP, ROLL_RULES, COMPONENTS, COMPLETED_ITEMS, ITEM_RULES, ARCHETYPES,
  AUG_QUESTIONS, MISTAKES, CHECKLIST, CREATORS, COST_COLORS,
} from './guide/guideData.js'

var HERO_SPLASHES = [
  { file: 'jhin', cost: 5, rot: '-6deg' },
  { file: 'xayah', cost: 4, rot: '3deg' },
  { file: 'samira', cost: 3, rot: '-2deg' },
]
var COST_HEX = { 5: '#e8a838', 4: '#b65ad6', 3: '#2c8fd6', 2: '#11b288', 1: '#9aa4b2' }

function goToSection(id) {
  if (typeof document === 'undefined') return
  var el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SectionHead(props) {
  return (
    <div className={'mb-8 ' + (props.className || '')}>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-xs font-bold text-primary">{props.kicker}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent max-w-[120px]" />
      </div>
      <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface leading-[0.95]">{props.title}</h2>
      {props.sub && <p className="font-body text-slate-400 text-sm md:text-base mt-3 max-w-2xl leading-relaxed">{props.sub}</p>}
    </div>
  )
}

export default function GuideScreen() {
  var _open = useState('stage3')
  var openId = _open[0]
  var setOpenId = _open[1]
  var _active = useState('anatomy')
  var activeChapter = _active[0]
  var setActiveChapter = _active[1]

  useEffect(function () {
    if (typeof IntersectionObserver === 'undefined') return
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setActiveChapter(e.target.id)
      })
    }, { rootMargin: '-18% 0px -72% 0px', threshold: 0 })
    CHAPTERS.forEach(function (c) {
      var el = document.getElementById(c.id)
      if (el) obs.observe(el)
    })
    return function () { obs.disconnect() }
  }, [])

  function toggle(id) {
    setOpenId(function (prev) { return prev === id ? null : id })
  }

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-20">

        {/* ── HERO ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 mb-6 min-h-[300px] md:min-h-[380px] flex items-center">
          <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(130% 130% at 100% 0%, rgba(232,168,56,0.16), transparent 52%), radial-gradient(110% 110% at 88% 110%, rgba(182,90,214,0.16), transparent 52%), #0d0d14' }} />
          <div className="absolute inset-0 z-[1] opacity-[0.05]" aria-hidden="true" style={{ backgroundImage: 'repeating-linear-gradient(62deg, #fff 0 1px, transparent 1px 28px)' }} />

          <div className="hidden lg:flex absolute right-6 xl:right-12 top-1/2 -translate-y-1/2 z-[2] items-center">
            {HERO_SPLASHES.map(function (s, i) {
              return (
                <div
                  key={s.file}
                  className="relative rounded-xl overflow-hidden shadow-2xl"
                  style={{ width: 162, height: 240, marginLeft: i === 0 ? 0 : -42, transform: 'rotate(' + s.rot + ')', border: '2px solid ' + COST_HEX[s.cost], zIndex: 10 - i }}
                >
                  <img src={'/guide/splash/' + s.file + '.png'} alt="" className="w-full h-full object-cover" style={{ objectPosition: 'center 22%' }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(8,8,14,0.9) 100%)' }} />
                </div>
              )
            })}
          </div>
          <div className="hidden lg:block absolute inset-y-0 right-0 w-[62%] z-[3] pointer-events-none" style={{ background: 'linear-gradient(90deg, #0d0d14 0%, rgba(13,13,20,0.6) 42%, transparent 100%)' }} />

          <div className="relative z-[4] p-8 md:p-14 max-w-xl">
            <span className="inline-flex items-center gap-2 font-label text-primary uppercase tracking-[0.2em] text-xs mb-5 bg-primary/10 border border-primary/25 rounded-full px-3 py-1">
              <Icon name="school" size={15} /> TFT Clash Academy
            </span>
            <h1 className="font-display text-6xl md:text-8xl font-bold text-on-surface leading-[0.88] mb-5">
              How To<br />
              <span className="relative inline-block">
                Climb
                <span className="absolute -bottom-1 left-0 right-0 h-1.5 bg-primary/70 rounded-full" />
              </span>
            </h1>
            <p className="font-body text-slate-300 text-base md:text-lg leading-relaxed mb-6 max-w-md">
              No tier lists, no copy-paste comps. The habits, the numbers, and the reads that take you from
              hardstuck to consistent.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
              <span className="text-tertiary">Set 17 / live data</span>
              <span className="text-slate-700">|</span>
              <span>6 chapters</span>
              <span className="text-slate-700">|</span>
              <span>~10 min read</span>
            </div>
          </div>
        </div>

        {/* ── STICKY CHAPTER NAV ── */}
        <div className="sticky top-[122px] z-20 -mx-4 px-4 py-3 mb-16 border-b border-white/5" style={{ background: 'rgba(15,15,21,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {CHAPTERS.map(function (c) {
              var on = activeChapter === c.id
              return (
                <button
                  key={c.id}
                  onClick={function () { goToSection(c.id) }}
                  className={'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-label uppercase tracking-wider text-[11px] font-bold whitespace-nowrap transition-colors ' + (on ? 'bg-primary/15 text-primary' : 'text-slate-500 hover:text-on-surface')}
                >
                  <Icon name={c.icon} size={15} className={on ? 'opacity-100' : 'opacity-60'} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── PRINCIPLES (editorial band, not cards) ── */}
        <div className="mb-16 md:mb-20">
          <p className="font-display text-2xl md:text-4xl font-bold text-on-surface leading-snug max-w-3xl mb-8">
            Climbing is not about knowing the best comp. It is three habits, run every single game.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border-y border-white/5">
            {PRINCIPLES.map(function (p) {
              return (
                <div key={p.n} className="bg-surface px-1 md:px-6 py-6 md:py-2">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-xs text-primary">{p.n}</span>
                    <span className="font-display text-3xl font-bold text-on-surface">{p.word}</span>
                  </div>
                  <p className="font-body text-slate-400 text-sm leading-relaxed max-w-xs">{p.line}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ANATOMY OF A COMP ── */}
        <div id="anatomy" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="READ IT LIKE A PRO" title="Anatomy of a Comp" sub="Every board is the same four things: the units, the trait they share, the items on one carry, and where they stand. Hover any unit." />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7">
              <Panel padding="spacious" radius="xl">
                <CompShowcase />
              </Panel>
            </div>
            <div className="lg:col-span-5">
              <ol className="space-y-7">
                {[
                  { n: '1', t: 'One carry, fully itemized', d: 'Jhin holds all three items. Three real items on one threat beats one item each on three bodies.' },
                  { n: '2', t: 'Traits fall out of the units', d: 'Five of these eight share Sniper, so it lights up gold for free. You pick units, the trait follows.' },
                  { n: '3', t: 'Front holds, back deals', d: 'Tanks eat the hits up front. Ranged carries hug the back corners, far from melee.' },
                ].map(function (a) {
                  return (
                    <li key={a.n} className="flex gap-4">
                      <span className="font-display text-2xl font-bold text-primary/40 leading-none w-7 flex-shrink-0">{a.n}</span>
                      <div>
                        <h4 className="font-display text-lg font-bold text-on-surface mb-1.5">{a.t}</h4>
                        <p className="font-body text-slate-400 text-sm leading-relaxed">{a.d}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
              <a href="/builder" className="group inline-flex items-center gap-2 mt-8 font-label uppercase tracking-wider text-xs font-bold text-primary hover:gap-3 transition-all">
                <Icon name="dashboard_customize" size={16} />
                Build your own comp
                <Icon name="arrow_forward" size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* ── HABITS (editorial sequence) ── */}
        <div id="habits" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 01" title="The Five Habits" sub="The reps that separate consistent top-fours from coin flips." />
          <div className="border-t border-white/5">
            {LESSONS.map(function (l) {
              var isOpen = openId === l.id
              return (
                <div key={l.id} className="border-b border-white/5">
                  <button onClick={function () { toggle(l.id) }} className="w-full flex items-center gap-5 md:gap-8 py-7 text-left group">
                    <span className={'font-display text-5xl md:text-6xl font-bold leading-none transition-colors ' + (isOpen ? 'text-primary' : 'text-white/10 group-hover:text-white/20')}>{l.num}</span>
                    <span className="flex-1">
                      <span className="font-label text-secondary uppercase tracking-widest text-[10px] font-bold block mb-1">{l.eyebrow}</span>
                      <span className="font-display text-2xl md:text-3xl font-bold text-on-surface leading-tight">{l.title}</span>
                    </span>
                    <span className={'flex-shrink-0 transition-transform duration-300 ' + (isOpen ? 'rotate-45 text-primary' : 'text-slate-600 group-hover:text-slate-400')}>
                      <Icon name="add" size={26} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-10 pl-0 md:pl-[6.5rem] max-w-2xl">
                      <p className="font-body text-slate-300 text-base leading-relaxed mb-5">{l.lede}</p>
                      <ul className="space-y-3 mb-7">
                        {l.points.map(function (pt, i) {
                          return (
                            <li key={i} className="flex items-start gap-3">
                              <span className="text-tertiary flex-shrink-0 pt-1"><Icon name="chevron_right" size={16} /></span>
                              <span className="font-body text-slate-400 text-sm leading-relaxed">{pt}</span>
                            </li>
                          )
                        })}
                      </ul>
                      <p className="font-display text-xl md:text-2xl font-bold text-primary leading-snug">
                        <span className="text-primary/40 mr-1">&ldquo;</span>{l.take}<span className="text-primary/40 ml-1">&rdquo;</span>
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ECONOMY & ROLLING ── */}
        <div id="econ" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 02" title="Economy & Rolling" sub="The numbers behind every decision. Learn these once and they stop being decisions." />

          {/* Interest + leveling, editorial two-up */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-10">
            <div>
              <h3 className="font-display text-xl font-bold text-on-surface mb-2">Interest is free gold</h3>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-5 max-w-md">
                One bonus gold per ten you bank, up to five. On top of a five-gold base, a streak pays up to
                three more. Win or loss, streaking is where the real gold comes from.
              </p>
              <div className="flex gap-2">
                {INTEREST.map(function (b) {
                  return (
                    <div key={b.gold} className="flex-1 text-center py-3 border border-white/8 rounded-lg">
                      <div className="font-mono text-sm font-bold text-on-surface">{b.gold}</div>
                      <div className="font-mono text-xs text-primary mt-1">{b.bonus}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-on-surface mb-2">A default leveling map</h3>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-5 max-w-md">
                Adjust to your board, and throw it out entirely when you reroll.
              </p>
              <div className="divide-y divide-white/5 border-y border-white/5">
                {LEVEL_MAP.map(function (lv) {
                  return (
                    <div key={lv.stage} className="flex items-center gap-4 py-2.5">
                      <span className="font-mono text-xs font-bold text-secondary min-w-[2.5rem]">{lv.stage}</span>
                      <span className="font-display text-sm font-bold text-on-surface min-w-[4.5rem]">{lv.move}</span>
                      <span className="font-body text-xs text-slate-500 leading-snug">{lv.detail}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Shop odds table */}
          <div className="mb-14">
            <h3 className="font-display text-2xl font-bold text-on-surface mb-1">Shop odds by level</h3>
            <p className="font-body text-slate-400 text-sm leading-relaxed mb-6 max-w-2xl">
              Your chance of seeing each cost per shop slot. This is why you roll at level 6, 7, 8 and not at
              random. The gold rows are the ones to memorize.
            </p>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-4 font-label uppercase tracking-widest text-[10px] text-slate-500">Level</th>
                    {SHOP_ODDS_COLS.map(function (col) {
                      return <th key={col.cost} className={'py-3 px-2 text-right font-label uppercase tracking-widest text-[10px] ' + col.cls}>{col.cost}-cost</th>
                    })}
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {SHOP_ODDS.map(function (row) {
                    var key = row.lvl >= 6 && row.lvl <= 9
                    return (
                      <tr key={row.lvl} className={'border-b border-white/[0.06] ' + (key ? 'bg-primary/[0.05]' : '')}>
                        <td className={'py-2.5 pr-4 ' + (key ? 'text-primary font-bold' : 'text-on-surface')}>Lvl {row.lvl}</td>
                        {row.odds.map(function (o, i) {
                          var col = SHOP_ODDS_COLS[i]
                          var dim = o === '-'
                          return <td key={i} className={'py-2.5 px-2 text-right ' + (dim ? 'text-slate-700' : col.cls)}>{dim ? '-' : o + '%'}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 mt-6 max-w-3xl">
              {ODDS_NOTES.map(function (n, i) {
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-tertiary flex-shrink-0 pt-0.5"><Icon name="arrow_right" size={16} /></span>
                    <span className="font-body text-xs text-slate-400 leading-relaxed">{n}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Rolling rules: numbered editorial matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden mb-10">
            {ROLL_RULES.map(function (rr, i) {
              return (
                <div key={rr.title} className="bg-surface p-6 flex gap-4">
                  <span className="font-mono text-xs text-tertiary pt-1">{'0' + (i + 1)}</span>
                  <div>
                    <h4 className="font-display text-base font-bold text-on-surface mb-1.5">{rr.title}</h4>
                    <p className="font-body text-slate-400 text-sm leading-relaxed">{rr.text}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Archetypes: editorial 3-up with cost dots */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border-y border-white/5">
            {ARCHETYPES.map(function (a) {
              return (
                <div key={a.name} className="bg-surface px-1 md:px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-tertiary"><Icon name={a.icon} size={20} /></span>
                    <h4 className="font-display text-lg font-bold text-on-surface">{a.name}</h4>
                  </div>
                  <p className="font-body text-slate-400 text-sm leading-relaxed">{a.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ITEMIZATION ── */}
        <div id="items" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 03" title="Itemization" sub="Items decide fights more than any single unit. Build them early, build them right." />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="font-display text-xl font-bold text-on-surface mb-3">The 8 components</h3>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-6 max-w-md">
                Any two combine into a finished item. You do not need every recipe, just the two that make
                your carry strong.
              </p>
              <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                {COMPONENTS.map(function (c) {
                  return (
                    <div key={c.file} className="flex flex-col items-center text-center gap-2">
                      <img src={'/guide/components/' + c.file + '.png'} alt={c.name} loading="lazy" className="w-12 h-12 md:w-14 md:h-14 rounded-md ring-1 ring-white/10" />
                      <span className="font-label text-[9px] uppercase tracking-wide text-slate-500 leading-tight">{c.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-on-surface mb-3">A best-in-slot carry build</h3>
              <p className="font-body text-slate-400 text-sm leading-relaxed mb-6 max-w-md">
                The dream items for a physical-damage carry. Aim for them, but a strong item you slam on Stage
                3 beats a perfect one that never arrives.
              </p>
              <div className="flex flex-wrap gap-5">
                {COMPLETED_ITEMS.map(function (ci) {
                  return (
                    <div key={ci.file} className="flex flex-col items-center text-center gap-2 w-[4.5rem]">
                      <img src={'/guide/items/' + ci.file + '.png'} alt={ci.name} loading="lazy" className="w-14 h-14 rounded-lg ring-1 ring-primary/25" />
                      <span className="font-label text-[9px] uppercase tracking-wide text-slate-500 leading-tight">{ci.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border-y border-white/5">
            {ITEM_RULES.map(function (it) {
              return (
                <div key={it.title} className="bg-surface px-1 md:px-6 py-5">
                  <span className="text-primary mb-2.5 block"><Icon name={it.icon} size={24} /></span>
                  <h4 className="font-display text-base font-bold text-on-surface mb-1.5">{it.title}</h4>
                  <p className="font-body text-slate-400 text-sm leading-relaxed">{it.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── POSITIONING ── */}
        <div id="positioning" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 04" title="Positioning" sub="Same units, different placement: that alone is the difference between a win and a loss." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <Panel padding="spacious" radius="xl">
              <span className="font-label text-tertiary uppercase tracking-widest text-xs font-bold mb-1 block">The one rule that matters most</span>
              <p className="font-display text-2xl font-bold text-on-surface mb-6 leading-tight">Tank in front of their carry</p>
              <PositioningBoard />
            </Panel>
            <div className="space-y-8">
              {[
                { icon: 'shield_person', t: 'Tank soaks, carry hides', d: 'Put your main tank directly in front of their main carry so it eats the damage. Tuck your carry in the opposite back corner.' },
                { icon: 'open_in_full', t: 'Spread vs clump', d: 'Spread the backline against area damage and reroll bombs. Clump only when you want one ability to hit their whole team.' },
                { icon: 'swap_horiz', t: 'Counter what you scout', d: 'Assassins dive the backline, so corner the carry behind a body. A long-range threat means protect the side they hit first.' },
              ].map(function (p) {
                return (
                  <div key={p.t} className="flex gap-4">
                    <span className="text-tertiary flex-shrink-0 pt-0.5"><Icon name={p.icon} size={22} /></span>
                    <div>
                      <h4 className="font-display text-lg font-bold text-on-surface mb-1.5">{p.t}</h4>
                      <p className="font-body text-slate-400 text-sm leading-relaxed max-w-sm">{p.d}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── AUGMENTS ── */}
        <div id="augments" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 05" title="Reading an Augment" sub="Three questions answer almost every augment choice faster than any tier list." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border-y border-white/5 mb-8">
            {AUG_QUESTIONS.map(function (a, i) {
              return (
                <div key={i} className="bg-surface px-1 md:px-6 py-6">
                  <span className="font-display text-4xl font-bold text-secondary/30 leading-none block mb-3">{'Q' + (i + 1)}</span>
                  <h4 className="font-display text-base font-bold text-on-surface mb-2 leading-tight">{a.q}</h4>
                  <p className="font-body text-slate-400 text-sm leading-relaxed">{a.a}</p>
                </div>
              )
            })}
          </div>
          <p className="font-display text-2xl md:text-3xl font-bold text-on-surface leading-snug max-w-3xl">
            A fitting <span className="text-slate-400">Silver</span> beats an off-comp <span className="text-secondary">Prismatic</span>.
            Rarity is a tiebreaker, not the decision.
          </p>
        </div>

        {/* ── HARDSTUCK (editorial anti-pattern list) ── */}
        <div id="mistakes" className="scroll-mt-[184px] mb-16 md:mb-20">
          <SectionHead kicker="CHAPTER 06" title="Why You're Hardstuck" sub="The same handful of habits cap most players. Cut these and your average placement climbs on its own." />
          <div className="border-t border-white/5">
            {MISTAKES.map(function (m, i) {
              return (
                <div key={m.t} className="border-b border-white/5 py-6 flex items-start gap-5 group">
                  <span className="font-display text-3xl md:text-4xl font-bold text-error/30 leading-none w-12 flex-shrink-0 group-hover:text-error/60 transition-colors">{'0' + (i + 1)}</span>
                  <div>
                    <h4 className="font-display text-lg md:text-xl font-bold text-on-surface mb-1.5">{m.t}</h4>
                    <p className="font-body text-slate-400 text-sm leading-relaxed max-w-2xl">{m.d}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── WHO TO WATCH ── */}
        <div className="mb-16 md:mb-20">
          <SectionHead kicker="LEARN FROM THE BEST" title="Who To Watch" sub="The fastest way to improve is to watch people who already think correctly, then steal their reads." />

          {/* Featured two */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {CREATORS.filter(function (c) { return c.feature }).map(function (c) {
              return (
                <a key={c.file} href={'https://twitch.tv/' + c.handle} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-white/8 hover:border-primary/30 bg-surface-container-low/40 hover:bg-surface-container-low transition-all p-6">
                  <div className="flex items-start gap-5">
                    <div className="rounded-full p-[2.5px] flex-shrink-0" style={{ background: COST_HEX[c.cost] }}>
                      <img src={'/guide/creators/' + c.file + '.png'} alt={c.name} loading="lazy" className="w-16 h-16 rounded-full object-cover bg-surface" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-xl font-bold text-on-surface">{c.name}</h4>
                        <span className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="open_in_new" size={15} /></span>
                      </div>
                      <span className="font-label uppercase tracking-wider text-[10px] font-bold text-primary">{c.role}</span>
                      <p className="font-body text-slate-400 text-sm leading-relaxed mt-2">{c.learn}</p>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>

          {/* The rest */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/5 border-y border-white/5">
            {CREATORS.filter(function (c) { return !c.feature }).map(function (c) {
              return (
                <a key={c.file} href={'https://twitch.tv/' + c.handle} target="_blank" rel="noopener noreferrer" className="group bg-surface hover:bg-surface-container-low/60 transition-colors px-3 py-5 flex flex-col items-center text-center">
                  <div className="rounded-full p-[2px] mb-3" style={{ background: COST_HEX[c.cost] }}>
                    <img src={'/guide/creators/' + c.file + '.png'} alt={c.name} loading="lazy" className="w-14 h-14 rounded-full object-cover bg-surface" />
                  </div>
                  <h4 className="font-display text-base font-bold text-on-surface">{c.name}</h4>
                  <span className="font-label uppercase tracking-wider text-[9px] font-bold text-primary mb-2">{c.role}</span>
                  <p className="font-body text-slate-500 text-xs leading-relaxed">{c.learn}</p>
                </a>
              )
            })}
          </div>
        </div>

        {/* ── 60-SECOND RECAP + CTA ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-white/8 p-7 h-full">
              <span className="font-label text-secondary uppercase tracking-widest text-xs font-bold mb-5 block">The 60-second version</span>
              <ul className="space-y-4">
                {CHECKLIST.map(function (c) {
                  return (
                    <li key={c.stage} className="flex items-start gap-3">
                      <span className="font-mono text-xs font-bold text-primary min-w-[3.5rem] pt-0.5">{c.stage}</span>
                      <span className="font-body text-sm text-slate-400 leading-relaxed">{c.note}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-xl h-full flex flex-col justify-center p-10 text-center" style={{ background: 'radial-gradient(120% 120% at 0% 0%, rgba(232,168,56,0.12), transparent 55%), #11111a' }}>
              <h3 className="font-display text-4xl md:text-5xl font-bold text-on-surface mb-3 leading-[0.95]">Now go put it<br />on the board.</h3>
              <p className="font-body text-slate-400 text-sm md:text-base max-w-md mx-auto mb-7 leading-relaxed">
                Reading is the easy part. Pick one chapter, force it every game this week, then come prove it.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Btn variant="primary" size="md" icon="swords" href="/clash">Find a Clash</Btn>
                <Btn variant="tertiary" size="md" icon="forum" href={DISCORD_URL}>Talk theory in Discord</Btn>
              </div>
            </div>
          </div>
        </div>

        <p className="font-body text-xs text-slate-600 text-center mt-12 leading-relaxed max-w-xl mx-auto">
          Shop odds and interest reflect the live set and shift on patches. The habits do not. Creator avatars
          link to their channels and belong to them.
        </p>

      </div>
    </PageLayout>
  )
}
