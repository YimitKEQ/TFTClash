import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Icon from '../ui/Icon'

var ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT
var ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT

// ── AdsenseSlot ───────────────────────────────────────────────────────────────
// Renders a real Google AdSense unit. Only mounted when VITE_ADSENSE_CLIENT is set.

function AdsenseSlot(props) {
  var size = props.size

  useEffect(function() {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {}
  }, [])

  if (size === 'rectangle') {
    return (
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '300px', height: '250px' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
      />
    )
  }

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

// ── HouseAd ───────────────────────────────────────────────────────────────────
// Pro upsell banner shown to free users when AdSense is not yet configured.

function HouseAd(props) {
  var size = props.size
  var navigate = useNavigate()

  function handleUpgrade() {
    navigate('/pricing')
  }

  if (size === 'rectangle') {
    return (
      <div className="w-[300px] h-[250px] bg-surface-container border border-outline-variant/20 rounded-xl flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon name="block" size={20} className="text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Go Ad-Free</p>
          <p className="font-editorial text-sm text-on-surface leading-snug">Priority registration, full career stats, zero ads.</p>
        </div>
        <button
          onClick={handleUpgrade}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary-fixed font-label text-xs uppercase tracking-widest hover:opacity-90 transition-opacity border-0 cursor-pointer"
        >
          {'\u20AC4.99/mo - Go Pro'}
        </button>
      </div>
    )
  }

  return (
    <div className="w-full py-3 px-5 bg-surface-container border border-outline-variant/20 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon name="workspace_premium" size={18} className="text-primary flex-shrink-0" />
        <p className="font-label text-xs text-on-surface-variant leading-snug">
          <span className="text-on-surface font-semibold">Pro members</span> lock their spot 10 min early, get full career stats, and see zero ads.
        </p>
      </div>
      <button
        onClick={handleUpgrade}
        className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-primary text-on-primary-fixed font-label text-xs uppercase tracking-widest hover:opacity-90 transition-opacity border-0 cursor-pointer whitespace-nowrap"
      >
        {'\u20AC4.99/mo - Go Pro'}
      </button>
    </div>
  )
}

// ── AdBanner ──────────────────────────────────────────────────────────────────
// Tier-gated ad slot. Returns null for Pro/Bundle/Host users (ad-free tiers).
// Renders AdsenseSlot when VITE_ADSENSE_CLIENT is set, else HouseAd.
//
// Props:
//   size      'banner' (default, responsive horizontal) | 'rectangle' (300x250)
//   className  extra wrapper classes

export default function AdBanner(props) {
  var size = props.size
  var className = props.className
  var ctx = useApp()
  var userTier = ctx.userTier || 'free'

  // Pro, Bundle, and Host tiers are ad-free
  if (userTier === 'pro' || userTier === 'bundle' || userTier === 'host') return null

  var resolvedSize = size || 'banner'

  return (
    <div className={className || ''}>
      {ADSENSE_CLIENT
        ? <AdsenseSlot size={resolvedSize} />
        : <HouseAd size={resolvedSize} />
      }
    </div>
  )
}
