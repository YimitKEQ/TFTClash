import { useState } from 'react'
import LaunchTournamentBanner from '../components/shared/LaunchTournamentBanner'

// Standalone preview for the launch tournament banner.
// Visit /banner-preview, tune the fields, then screenshot the framed
// banner at native 1200x630. The banner is rendered scaled-down for the
// editor view but use the "Open raw" button to view at 1:1.
export default function BannerPreviewScreen() {
  var _title = useState('LAUNCH CLASH')
  var title = _title[0], setTitle = _title[1]
  var _subtitle = useState('The First Custom Tournament')
  var subtitle = _subtitle[0], setSubtitle = _subtitle[1]
  var _date = useState('SAT MAY 10')
  var dateText = _date[0], setDate = _date[1]
  var _region = useState('EU + NA')
  var region = _region[0], setRegion = _region[1]
  var _cta = useState('Register Free at tftclash.com')
  var cta = _cta[0], setCta = _cta[1]
  var _tagline = useState('Prize pool scales with the field. Every player makes the pot bigger.')
  var tagline = _tagline[0], setTagline = _tagline[1]

  var _p1Perk = useState('Pro Membership (1 yr)')
  var p1Perk = _p1Perk[0], setP1Perk = _p1Perk[1]
  var _p1Cash = useState('50% of pool')
  var p1Cash = _p1Cash[0], setP1Cash = _p1Cash[1]
  var _p2Perk = useState('Pro Membership (6 mo)')
  var p2Perk = _p2Perk[0], setP2Perk = _p2Perk[1]
  var _p2Cash = useState('30% of pool')
  var p2Cash = _p2Cash[0], setP2Cash = _p2Cash[1]
  var _p3Perk = useState('Pro Membership (3 mo)')
  var p3Perk = _p3Perk[0], setP3Perk = _p3Perk[1]
  var _p3Cash = useState('20% of pool')
  var p3Cash = _p3Cash[0], setP3Cash = _p3Cash[1]

  var _scale = useState(0.65)
  var scale = _scale[0], setScale = _scale[1]
  var _rawMode = useState(false)
  var rawMode = _rawMode[0], setRawMode = _rawMode[1]

  var prizes = [
    { medal: '1st', perk: p1Perk, cash: p1Cash, tone: 'gold' },
    { medal: '2nd', perk: p2Perk, cash: p2Cash, tone: 'silver' },
    { medal: '3rd', perk: p3Perk, cash: p3Cash, tone: 'bronze' }
  ]

  if (rawMode) {
    return (
      <div style={{ width: 1200, height: 630, background: '#000' }}>
        <LaunchTournamentBanner
          title={title}
          subtitle={subtitle}
          dateText={dateText}
          regionText={region}
          ctaText={cta}
          tagline={tagline}
          prizes={prizes}
        />
        <button
          onClick={function() { setRawMode(false) }}
          style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, padding: '8px 14px', background: '#13131a', color: '#fff', border: '1px solid #ffc66b', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          Exit Raw
        </button>
      </div>
    )
  }

  function row(labelText, value, setter) {
    return (
      <label className="block mb-3">
        <span className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{labelText}</span>
        <input
          value={value}
          onChange={function(e) { setter(e.target.value) }}
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
        />
      </label>
    )
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl uppercase tracking-tight text-primary">Launch Banner Preview</h1>
          <div className="flex items-center gap-3">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Scale
              <input type="range" min="0.25" max="1" step="0.05" value={scale}
                     onChange={function(e) { setScale(parseFloat(e.target.value)) }}
                     className="ml-2 align-middle" />
              <span className="ml-2 font-mono text-xs">{Math.round(scale * 100)}%</span>
            </label>
            <button
              onClick={function() { setRawMode(true) }}
              className="bg-primary text-on-primary font-label font-bold text-xs uppercase tracking-widest px-4 py-2 rounded cursor-pointer border-0"
            >
              Open Raw 1:1 (for screenshot)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
          <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4 max-h-[80vh] overflow-y-auto">
            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3">Headline</h2>
            {row('Title', title, setTitle)}
            {row('Subtitle', subtitle, setSubtitle)}
            {row('Date', dateText, setDate)}
            {row('Region', region, setRegion)}

            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-5 mb-3">Top 3 Prizes</h2>
            {row('1st - Perk', p1Perk, setP1Perk)}
            {row('1st - Cash', p1Cash, setP1Cash)}
            {row('2nd - Perk', p2Perk, setP2Perk)}
            {row('2nd - Cash', p2Cash, setP2Cash)}
            {row('3rd - Perk', p3Perk, setP3Perk)}
            {row('3rd - Cash', p3Cash, setP3Cash)}

            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-5 mb-3">Footer</h2>
            {row('Tagline', tagline, setTagline)}
            {row('CTA', cta, setCta)}

            <p className="font-body text-xs text-on-surface-variant/60 mt-4 leading-relaxed">
              Click "Open Raw 1:1" then screenshot the 1200x630 frame for OG / Twitter / Discord.
              Native browser screenshot tools (DevTools full-page screenshot, Cmd+Shift+S, ShareX, etc.) all work.
            </p>
          </div>

          <div className="bg-black/40 border border-outline-variant/20 rounded-lg p-4 overflow-auto">
            <div style={{ width: 1200 * scale, height: 630 * scale, position: 'relative' }}>
              <div style={{ width: 1200, height: 630, transform: 'scale(' + scale + ')', transformOrigin: 'top left' }}>
                <LaunchTournamentBanner
                  title={title}
                  subtitle={subtitle}
                  dateText={dateText}
                  regionText={region}
                  ctaText={cta}
                  tagline={tagline}
                  prizes={prizes}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
