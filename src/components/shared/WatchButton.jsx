import { useState, useEffect } from 'react'
import { Icon } from '../ui'
import { isWatched, toggleWatched, WATCHLIST_EVENT } from '../../lib/watchlist.js'

export default function WatchButton(props) {
  var name = props.name
  var size = props.size || 'sm'
  var onChange = props.onChange
  var stopPropagation = props.stopPropagation !== false

  var _watched = useState(false)
  var watched = _watched[0]
  var setWatched = _watched[1]

  useEffect(function () {
    if (!name) return
    setWatched(isWatched(name))
    function onEvent() { setWatched(isWatched(name)) }
    if (typeof window !== 'undefined') {
      window.addEventListener(WATCHLIST_EVENT, onEvent)
      window.addEventListener('storage', onEvent)
    }
    return function () {
      if (typeof window !== 'undefined') {
        window.removeEventListener(WATCHLIST_EVENT, onEvent)
        window.removeEventListener('storage', onEvent)
      }
    }
  }, [name])

  function handleClick(e) {
    if (stopPropagation && e && e.stopPropagation) e.stopPropagation()
    if (e && e.preventDefault) e.preventDefault()
    if (!name) return
    var nowWatched = toggleWatched(name)
    setWatched(nowWatched)
    if (onChange) onChange(nowWatched)
  }

  if (!name) return null

  var iconSize = size === 'lg' ? 18 : size === 'md' ? 16 : 14
  var padClass = size === 'lg' ? 'px-3 py-1.5 text-xs' : size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
  var stateClass = watched
    ? 'bg-secondary/15 border-secondary/40 text-secondary'
    : 'bg-surface-container border-outline-variant/15 text-on-surface-variant/70 hover:border-secondary/30 hover:text-on-surface'

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={watched}
      title={watched ? 'Stop watching ' + name : 'Watch ' + name}
      className={'inline-flex items-center gap-1 rounded-md border font-label tracking-wider uppercase font-bold transition-colors ' + padClass + ' ' + stateClass}
    >
      <Icon name={watched ? 'visibility' : 'visibility_off'} size={iconSize} />
      <span>{watched ? 'Watching' : 'Watch'}</span>
    </button>
  )
}
