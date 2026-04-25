import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'

// Lazy Twitch iframe embed. Won't load the iframe until user opts in
// (saves bandwidth + avoids Twitch tracking until the viewer chose to watch).
//
// Props:
//   channel: twitch channel handle (lowercase, no leading @)
//   parentDomains: array of allowed parents. Defaults to current host + tftclash.com.
//   compact: if true, smaller chrome.

function getParents(extra) {
  var parents = ['tftclash.com', 'www.tftclash.com']
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    var h = window.location.hostname
    if (parents.indexOf(h) === -1) parents.push(h)
  }
  if (extra && extra.length) {
    extra.forEach(function (d) { if (parents.indexOf(d) === -1) parents.push(d) })
  }
  return parents
}

export default function TwitchEmbed(props) {
  var channel = (props.channel || '').replace(/^@/, '').trim().toLowerCase()
  var compact = !!props.compact

  var _open = useState(false)
  var open = _open[0]; var setOpen = _open[1]

  var _live = useState(null)  // null = unknown, true = live, false = offline
  var live = _live[0]; var setLive = _live[1]
  var ref = useRef(null)

  useEffect(function () {
    if (!channel) return
    var alive = true
    fetch('https://decapi.me/twitch/uptime/' + encodeURIComponent(channel))
      .then(function (r) { return r.text() })
      .then(function (txt) {
        if (!alive) return
        var t = (txt || '').toLowerCase()
        var offline = t.indexOf('offline') > -1 || t.indexOf('not live') > -1
        setLive(!offline)
      })
      .catch(function () {})
    return function () { alive = false }
  }, [channel])

  if (!channel) return null

  var parents = getParents(props.parentDomains)
  var src = 'https://player.twitch.tv/?channel=' + encodeURIComponent(channel) +
    '&parent=' + parents.join('&parent=') +
    '&autoplay=true&muted=true'

  return (
    <div ref={ref} className="bg-surface-container-low border border-outline-variant/15 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-outline-variant/10 bg-surface-container">
        <span className={'inline-block w-2 h-2 rounded-full ' + (live === true ? 'bg-error animate-pulse' : live === false ? 'bg-on-surface/30' : 'bg-on-surface/20')} />
        <span className="font-label uppercase text-[10px] tracking-widest text-on-surface">{live === true ? 'Live now' : live === false ? 'Offline' : 'Twitch'}</span>
        <span className="font-mono text-xs text-on-surface/60 truncate">@{channel}</span>
        <a href={'https://twitch.tv/' + channel} target="_blank" rel="noopener noreferrer" className="ml-auto font-label uppercase text-[10px] tracking-widest text-secondary hover:text-secondary/80">
          Open <Icon name="open_in_new" size={11} />
        </a>
      </div>
      {open ? (
        <div className="relative" style={{ paddingTop: compact ? '40%' : '56.25%' }}>
          <iframe
            src={src}
            allowFullScreen
            allow="autoplay; fullscreen"
            className="absolute inset-0 w-full h-full"
            title={'Twitch stream: ' + channel}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={function () { setOpen(true) }}
          className="w-full aspect-video bg-surface-container-high hover:bg-surface-container transition-colors flex flex-col items-center justify-center gap-2"
        >
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
            <Icon name="play_arrow" size={28} className="text-error" />
          </div>
          <span className="font-label uppercase text-xs tracking-widest text-on-surface">{live === true ? 'Click to watch live' : 'Click to load stream'}</span>
          <span className="font-mono text-[10px] text-on-surface/40">twitch.tv/{channel}</span>
        </button>
      )}
    </div>
  )
}
