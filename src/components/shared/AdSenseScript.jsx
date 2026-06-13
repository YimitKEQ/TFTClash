import { useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { ADSENSE_PUBLISHER_ID, isAdFreeTier } from '../../lib/adsense'

// Loads the Google AdSense library script, but only for ad-eligible visitors.
// Pro/Bundle/Host subscribers never load it, honoring the "zero ads" promise
// (no ad cookies, no requests to Google). Anonymous visitors and free users do
// load it, so AdSense verification and ad serving work normally.
//
// Renders nothing. Mounted once at the app root (inside AppProvider).
var SCRIPT_ID = 'adsbygoogle-lib'

export default function AdSenseScript() {
  var ctx = useApp()
  var userTier = ctx.userTier || 'free'
  var isAuthLoading = ctx.isAuthLoading
  var currentUser = ctx.currentUser
  var subscriptionsLoaded = ctx.subscriptionsLoaded

  // The user's tier is only known once auth has resolved, and for logged-in
  // users once their subscription has loaded. Injecting before then would race:
  // a Pro user would briefly load the script while their tier still reads "free".
  var tierKnown = !isAuthLoading && (!currentUser || subscriptionsLoaded)
  var adEligible = tierKnown && !isAdFreeTier(userTier)

  useEffect(function() {
    if (!adEligible) return
    if (document.getElementById(SCRIPT_ID)) return
    var s = document.createElement('script')
    s.id = SCRIPT_ID
    s.async = true
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_PUBLISHER_ID
    s.crossOrigin = 'anonymous'
    document.head.appendChild(s)
  }, [adEligible])

  return null
}
