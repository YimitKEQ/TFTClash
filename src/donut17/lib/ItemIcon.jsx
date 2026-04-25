// ItemIcon -- renders an item with hover tooltip showing name + description.
// Item icons are stored in items.json as cdragon .tex URLs that need to be
// rewritten to .png for browser rendering.

import { useState } from 'react'

function pngUrl(icon) {
  if (!icon) return ''
  return icon.replace(/\.tex$/, '.png')
}

export default function ItemIcon(props) {
  var item = props.item
  if (!item) return null
  var size = props.size || 32

  var _h = useState(false)
  var hover = _h[0]
  var setHover = _h[1]

  var url = pngUrl(item.icon)

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={function(){ setHover(true) }}
      onMouseLeave={function(){ setHover(false) }}
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={item.name}
        title={item.name}
        style={{
          width: size,
          height: size,
          border: '1px solid rgba(255,198,107,0.55)',
          background: '#0e0d15',
          boxShadow: hover ? '0 0 8px rgba(255,198,107,0.55)' : 'none',
          transition: 'box-shadow 120ms ease',
          objectFit: 'cover',
        }}
        onError={function (e) { e.target.style.opacity = '0.3' }}
      />
      {hover && (
        <span
          className="absolute z-50 pointer-events-none"
          style={{
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 220,
            maxWidth: 280,
            background: '#1b1b23',
            border: '1px solid rgba(255,198,107,0.35)',
            padding: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          }}
        >
          <span className="block font-editorial italic text-sm" style={{ color: '#FFC66B' }}>
            {item.name}
          </span>
          {item.desc && (
            <span
              className="block font-body text-[10px] mt-1.5 leading-snug"
              style={{ color: 'rgba(228,225,236,0.75)' }}
            >
              {stripTags(item.desc).slice(0, 200)}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// Strip XML-style tftitemrules / scaling tags from cdragon item descriptions.
// Keeps the readable English. Numbers stay; Riot's templating placeholders
// (like @AP@) are kept as-is -- they are still informative.
function stripTags(s) {
  return String(s || '')
    .replace(/<br\s*\/?>(\s*)/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
