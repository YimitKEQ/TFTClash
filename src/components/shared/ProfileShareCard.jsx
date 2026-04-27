import { useState } from 'react'
import { Icon } from '../ui'

function buildShareUrl(name, origin) {
  var safe = encodeURIComponent(String(name || '').slice(0, 60))
  var base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://tftclash.com')
  return base + '/api/share-card?name=' + safe
}

export default function ProfileShareCard(props) {
  var player = props.player
  if (!player || !player.name) return null

  var src = buildShareUrl(player.name)

  var _copied = useState(null)
  var copied = _copied[0]
  var setCopied = _copied[1]

  function flash(which) {
    setCopied(which)
    setTimeout(function () { setCopied(null) }, 1500)
  }

  function copyLink() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(src).then(function () { flash('link') }).catch(function () {})
  }

  function downloadCard() {
    if (typeof window === 'undefined') return
    fetch(src).then(function (r) { return r.blob() }).then(function (blob) {
      var url = window.URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = 'tftclash-' + String(player.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.svg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      flash('download')
    }).catch(function () {})
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="ios_share" className="text-primary" />
          <h3 className="font-display text-base tracking-wide">SHARE CARD</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          1200 x 630 SVG
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-outline-variant/10 bg-black/30 aspect-[1200/630] mb-3">
        <img
          src={src}
          alt={'Share card for ' + player.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={copyLink}
          className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-label tracking-wider uppercase font-bold transition-colors ' + (copied === 'link' ? 'bg-success/15 border-success/40 text-success' : 'bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30')}
          title="Copy share-card URL"
        >
          <Icon name="link" size={14} />
          {copied === 'link' ? 'Copied!' : 'Copy URL'}
        </button>
        <button
          type="button"
          onClick={downloadCard}
          className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-label tracking-wider uppercase font-bold transition-colors ' + (copied === 'download' ? 'bg-success/15 border-success/40 text-success' : 'bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30')}
          title="Download SVG"
        >
          <Icon name="download" size={14} />
          {copied === 'download' ? 'Saved!' : 'Download'}
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30 text-xs font-label tracking-wider uppercase font-bold"
          title="Open in new tab"
        >
          <Icon name="open_in_new" size={14} />
          Open
        </a>
      </div>
    </div>
  )
}
