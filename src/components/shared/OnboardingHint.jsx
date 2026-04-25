import { useState, useEffect } from 'react'
import { Icon } from '../ui'

var KEY = 'tft-onboarding-hint-v1'

function readDismissed() {
  if (typeof window === 'undefined') return {}
  try {
    var raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    var parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    return {}
  }
}

function writeDismissed(map) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY, JSON.stringify(map)) } catch (e) {}
}

export default function OnboardingHint(props) {
  var variant = props.variant || 'guest'
  var title = props.title
  var body = props.body
  var ctaLabel = props.ctaLabel
  var onCta = props.onCta
  var secondaryLabel = props.secondaryLabel
  var onSecondary = props.onSecondary
  var icon = props.icon || 'rocket_launch'

  var _dismissed = useState(true)
  var dismissed = _dismissed[0]
  var setDismissed = _dismissed[1]

  useEffect(function () {
    var map = readDismissed()
    setDismissed(!!map[variant])
  }, [variant])
  // dismissed defaults to true so SSR / pre-effect renders do not flash the banner;
  // the effect above flips it to false only when the variant has not been dismissed.

  function dismiss() {
    var map = readDismissed()
    var next = Object.assign({}, map)
    next[variant] = Date.now()
    writeDismissed(next)
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent backdrop-blur p-4 sm:p-5 relative">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 text-on-surface-variant/40 hover:text-on-surface p-1 rounded-md"
        title="Dismiss"
        aria-label="Dismiss hint"
      >
        <Icon name="close" size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
          <Icon name={icon} className="text-primary" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base sm:text-lg text-on-surface mb-0.5">{title}</div>
          <div className="text-sm text-on-surface-variant/80 leading-relaxed">{body}</div>
          {(ctaLabel || secondaryLabel) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {ctaLabel && (
                <button
                  type="button"
                  onClick={onCta}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-label tracking-wider uppercase font-bold hover:bg-primary/90"
                >
                  {ctaLabel}
                </button>
              )}
              {secondaryLabel && (
                <button
                  type="button"
                  onClick={onSecondary}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface text-xs font-label tracking-wider uppercase font-bold hover:bg-surface-container-high"
                >
                  {secondaryLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
