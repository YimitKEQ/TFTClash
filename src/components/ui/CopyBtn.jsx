import { useState, useEffect, useRef } from 'react'
import Icon from './Icon'

// Lightweight click-to-copy button. Falls back to execCommand on older browsers.
// Emits a flash "copied" state for 1.2s. Optional inline variant renders beside text.
export default function CopyBtn(props) {
  var value = props.value
  var label = props.label
  var title = props.title || 'Copy'
  var size = props.size || 14
  var className = props.className || ''
  var onCopied = props.onCopied

  var _copied = useState(false)
  var copied = _copied[0]
  var setCopied = _copied[1]
  var timerRef = useRef(null)

  useEffect(function() {
    return function() { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function copy(e) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    if (!value) return
    var text = String(value)
    var done = function() {
      setCopied(true)
      if (onCopied) onCopied(text)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(function() { setCopied(false) }, 1200)
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function() { legacy(text, done) })
        return
      }
    } catch (err) { /* fall through */ }
    legacy(text, done)
  }

  function legacy(text, done) {
    try {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      done()
    } catch (err) { /* silent */ }
  }

  var base = 'inline-flex items-center gap-1 text-on-surface/50 hover:text-primary transition-colors cursor-pointer'
  var feedback = copied ? 'text-success hover:text-success' : ''

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied!' : title}
      aria-label={copied ? 'Copied to clipboard' : title}
      className={base + ' ' + feedback + ' ' + className}
    >
      <Icon name={copied ? 'check' : 'content_copy'} size={size} />
      {label && <span className="text-xs">{copied ? 'Copied' : label}</span>}
    </button>
  )
}
