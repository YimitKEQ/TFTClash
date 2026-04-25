import { useState } from 'react'
import { Icon } from '../ui'

function buildShareUrl(network, opts) {
  var url = encodeURIComponent(opts.url || '')
  var text = encodeURIComponent(opts.text || '')
  if (network === 'twitter') {
    return 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url
  }
  if (network === 'reddit') {
    return 'https://www.reddit.com/submit?url=' + url + '&title=' + text
  }
  if (network === 'facebook') {
    return 'https://www.facebook.com/sharer/sharer.php?u=' + url + '&quote=' + text
  }
  if (network === 'linkedin') {
    return 'https://www.linkedin.com/sharing/share-offsite/?url=' + url
  }
  return ''
}

function ShareButton(props) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-label tracking-wider uppercase font-bold transition-colors ' + (props.color || 'bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30')}
      title={props.title}
    >
      <Icon name={props.icon} size={14} />
      <span>{props.label}</span>
    </button>
  )
}

export default function SocialShareBar(props) {
  var url = props.url || (typeof window !== 'undefined' ? window.location.href : '')
  var text = props.text || 'Check this out on TFT Clash'

  var _copied = useState(null)
  var copied = _copied[0]
  var setCopied = _copied[1]

  function open(network) {
    var href = buildShareUrl(network, { url: url, text: text })
    if (!href) return
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer,width=550,height=420')
    }
  }

  function flashCopied(which) {
    setCopied(which)
    setTimeout(function () { setCopied(null) }, 1500)
  }

  function copyLink() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(url).then(function () {
      flashCopied('link')
    }).catch(function () {})
  }

  function copyMarkdown() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    var safeText = String(text || '').replace(/[\[\]]/g, '')
    var md = '[' + safeText + '](' + url + ')'
    navigator.clipboard.writeText(md).then(function () {
      flashCopied('md')
    }).catch(function () {})
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ShareButton
        icon="share"
        label="Tweet"
        title="Share on X / Twitter"
        color="bg-[#1DA1F2]/10 border-[#1DA1F2]/30 text-[#1DA1F2] hover:bg-[#1DA1F2]/20"
        onClick={function () { open('twitter') }}
      />
      <ShareButton
        icon="forum"
        label="Reddit"
        title="Share on Reddit"
        color="bg-[#FF4500]/10 border-[#FF4500]/30 text-[#FF4500] hover:bg-[#FF4500]/20"
        onClick={function () { open('reddit') }}
      />
      <ShareButton
        icon="thumb_up"
        label="FB"
        title="Share on Facebook"
        color="bg-[#1877F2]/10 border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/20"
        onClick={function () { open('facebook') }}
      />
      <ShareButton
        icon="link"
        label={copied === 'link' ? 'Copied!' : 'Copy'}
        title="Copy link"
        color={copied === 'link' ? 'bg-success/15 border-success/40 text-success' : 'bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30'}
        onClick={copyLink}
      />
      <ShareButton
        icon="format_quote"
        label={copied === 'md' ? 'Copied!' : 'MD'}
        title="Copy markdown link"
        color={copied === 'md' ? 'bg-success/15 border-success/40 text-success' : 'bg-surface-container border-outline-variant/15 text-on-surface hover:border-primary/30'}
        onClick={copyMarkdown}
      />
    </div>
  )
}
