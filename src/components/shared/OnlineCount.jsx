import { useState, useEffect } from 'react'
import { Icon } from '../ui'
import { supabase } from '../../lib/supabase'

export default function OnlineCount(props) {
  var label = props.label || 'live'
  var className = props.className || ''

  var _count = useState(1)
  var count = _count[0]
  var setCount = _count[1]

  useEffect(function () {
    if (!supabase || !supabase.channel) return
    var channel
    try {
      channel = supabase.channel('platform-presence', {
        config: { presence: { key: 'anon-' + Math.random().toString(36).slice(2, 10) } },
      })

      channel
        .on('presence', { event: 'sync' }, function () {
          try {
            var state = channel.presenceState()
            var n = Object.keys(state || {}).length
            setCount(n > 0 ? n : 1)
          } catch (e) {}
        })
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') {
            try { channel.track({ at: Date.now() }) } catch (e) {}
          }
        })
    } catch (e) {}

    return function () {
      try { if (channel) channel.unsubscribe() } catch (e) {}
    }
  }, [])

  return (
    <span className={'inline-flex items-center gap-1.5 text-xs font-label tracking-wider ' + className}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--md-success)] opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--md-success)]"></span>
      </span>
      <span className="text-white/70">{count} {label}</span>
    </span>
  )
}
