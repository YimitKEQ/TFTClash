// Hash-based active tab hook scoped to /donut17. Uses URL hash so refreshes
// and back/forward preserve tab state without touching react-router.

import { useState, useEffect } from 'react'

export function useActiveTab(defaultTab) {
  var init = defaultTab
  if (typeof window !== 'undefined' && window.location.hash) {
    var fromHash = window.location.hash.replace(/^#/, '')
    if (fromHash) init = fromHash
  }
  var _s = useState(init)
  var tab = _s[0]
  var setTab = _s[1]

  useEffect(function () {
    function onHash() {
      var h = window.location.hash.replace(/^#/, '')
      if (h) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return function () { window.removeEventListener('hashchange', onHash) }
  }, [])

  function setTabAndHash(next) {
    setTab(next)
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', window.location.pathname + '#' + next)
    }
  }

  return [tab, setTabAndHash]
}
