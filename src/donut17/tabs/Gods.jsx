import { useState } from 'react'
import { makeImgFallback } from '../lib/imgFallback'

export default function Gods(props) {
  var gods = props.data.gods || []
  var _s = useState(gods[0] ? gods[0].key : null)
  var selected = _s[0]
  var setSelected = _s[1]
  var god = gods.find(function(g){ return g.key === selected }) || gods[0]

  return (
    <div>
      <Header/>
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-4 space-y-2">
          {gods.map(function (g) {
            var active = g.key === (god && god.key)
            return (
              <button
                key={g.key}
                type="button"
                onClick={function(){ setSelected(g.key) }}
                className="w-full text-left p-4 flex items-center gap-4 transition-all cursor-pointer"
                style={{
                  background: active ? '#2a2931' : '#1b1b23',
                  borderLeft: active ? '4px solid ' + g.color : '4px solid transparent',
                  boxShadow: active ? '0 0 20px rgba(0,0,0,0.3)' : 'none'
                }}
              >
                <img
                  alt={g.name}
                  src={g.image}
                  onError={makeImgFallback(0)}
                  className="w-12 h-12 object-cover"
                  style={{ border: '1px solid ' + g.color + '55' }}
                />
                <div>
                  <p className="font-editorial italic text-lg" style={{ color: active ? g.color : '#e4e1ec' }}>{g.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.45)' }}>{g.title}</p>
                </div>
              </button>
            )
          })}
        </aside>

        <section className="col-span-12 lg:col-span-8">
          {god && <GodDetail god={god}/>}
        </section>
      </div>
    </div>
  )
}

function GodDetail(props) {
  var god = props.god
  return (
    <div className="d17-panel-hi p-8 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 20% 0%, ' + god.color + '22 0%, transparent 60%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: god.color }}>{god.title}</span>
            <h2 className="font-editorial italic text-5xl mt-1" style={{ color: god.color }}>{god.name}</h2>
            <p className="font-body text-sm mt-4 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.80)' }}>
              {god.blessing}
            </p>
          </div>
          <img
            alt={god.name}
            src={god.image}
            onError={makeImgFallback(0)}
            className="w-28 h-28 object-cover"
            style={{ border: '2px solid ' + god.color, boxShadow: '0 0 32px ' + god.color + '44' }}
          />
        </div>

        <div className="d17-divider my-8"/>

        <p className="font-label uppercase tracking-widest text-xs mb-4" style={{ color: 'rgba(228,225,236,0.55)' }}>
          Stage Offerings
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stage label="Stage 2" items={(god.offerings && god.offerings.stage2) || []}/>
          <Stage label="Stage 3" items={(god.offerings && god.offerings.stage3) || []}/>
          <Stage label="Stage 4" items={(god.offerings && god.offerings.stage4) || []}/>
        </div>

        <div className="d17-divider my-8"/>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="font-label uppercase tracking-widest text-xs mb-2" style={{ color: 'rgba(228,225,236,0.55)' }}>Tip</p>
            <p className="font-editorial italic text-lg leading-relaxed" style={{ color: '#e4e1ec' }}>"{god.tip}"</p>
          </div>
          <div>
            <p className="font-label uppercase tracking-widest text-xs mb-2" style={{ color: 'rgba(228,225,236,0.55)' }}>Best Comps</p>
            <div className="flex flex-wrap gap-2">
              {(god.bestComps || []).map(function (c) {
                return (
                  <span
                    key={c}
                    className="px-3 py-1 font-mono text-[11px]"
                    style={{ background: god.color + '18', color: god.color, border: '1px solid ' + god.color + '44' }}
                  >{c}</span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stage(props) {
  return (
    <div className="d17-panel-lo p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: '#FFC66B' }}>{props.label}</p>
      <ul className="space-y-2">
        {props.items.map(function (it, i) {
          return (
            <li key={i} className="text-xs font-body leading-relaxed" style={{ color: 'rgba(228,225,236,0.78)' }}>
              <span className="text-primary mr-2">-</span>{it}
            </li>
          )
        })}
        {props.items.length === 0 && (
          <li className="text-xs font-mono" style={{ color: '#504535' }}>-- no options --</li>
        )}
      </ul>
    </div>
  )
}

function Header() {
  return (
    <div className="mb-10">
      <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>The Pantheon</span>
      <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Space Gods</h1>
      <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
        Choose your patron at Stage 2-1. Each god grants a unique blessing and stage-gated offerings. Pick the one that matches your opener and your god-given comp.
      </p>
    </div>
  )
}
