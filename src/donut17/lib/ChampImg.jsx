import { useRef } from 'react'
import { costColor } from './imgFallback'

// ChampImg -- tries a chain of image URLs in order, swapping on 404:
// 1. cdragon HUD square (authoritative Riot portrait)
// 2. cdragon skin splash PNG
// 3. tactics.tools face_lg
// 4. SVG cost-colored initials placeholder
//
// Usage: <ChampImg champion={ch} size={40} carry/>

function initialsSvg(name, cost) {
  var color = costColor(cost)
  var initials = String(name || '?').split(/\s+/).map(function(w){ return w.charAt(0) }).join('').slice(0, 2).toUpperCase()
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    + '<rect width="64" height="64" fill="' + color + '" opacity="0.22"/>'
    + '<rect x="2" y="2" width="60" height="60" fill="none" stroke="' + color + '" stroke-width="2"/>'
    + '<text x="32" y="40" text-anchor="middle" fill="' + color + '" font-family="monospace" font-size="22" font-weight="700">'
    + initials + '</text></svg>'
  )
}

export default function ChampImg(props) {
  var ch = props.champion || {}
  var a = ch.assets || {}
  var size = props.size || 40
  var carry = !!props.carry
  var className = props.className || ''
  var extraStyle = props.style || {}

  var stepRef = useRef(0)
  var chain = [a.hud, a.square, a.face_lg, a.face]
  chain = chain.filter(function(u){ return typeof u === 'string' && u.length > 0 })
  var fallback = initialsSvg(ch.name, ch.cost)

  function handleError(e) {
    stepRef.current += 1
    if (stepRef.current < chain.length) {
      e.target.src = chain[stepRef.current]
      return
    }
    if (e.target.src !== fallback) {
      e.target.src = fallback
    }
  }

  var border = carry
    ? '2px solid #FFC66B'
    : '1px solid ' + costColor(ch.cost)
  var shadow = carry ? '0 0 10px rgba(255,198,107,0.55)' : 'none'

  var style = {
    width: size,
    height: size,
    objectFit: 'cover',
    border: border,
    boxShadow: shadow,
    background: '#0e0d15'
  }
  Object.keys(extraStyle).forEach(function(k){ style[k] = extraStyle[k] })

  return (
    <img
      alt={ch.name || 'champion'}
      src={chain[0] || fallback}
      onError={handleError}
      className={className}
      style={style}
      title={props.title || (ch.name + (ch.cost ? ' (' + ch.cost + '-cost)' : ''))}
    />
  )
}
