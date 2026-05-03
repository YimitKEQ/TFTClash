import { useEffect, useRef, useState } from 'react'
import { Btn, Panel, Icon } from '../ui'

export default function ConfirmModal(props) {
  var open = props.open
  var title = props.title || 'Confirm'
  var message = props.message || ''
  var confirmLabel = props.confirmLabel || 'Confirm'
  var cancelLabel = props.cancelLabel || 'Cancel'
  var destructive = !!props.destructive
  var requiresInput = !!props.requiresInput
  var inputLabel = props.inputLabel || ''
  var inputPlaceholder = props.inputPlaceholder || ''
  var inputMaxLength = props.inputMaxLength || 500
  var allowEmptyInput = !!props.allowEmptyInput
  var onConfirm = props.onConfirm
  var onCancel = props.onCancel

  var inputState = useState('')
  var value = inputState[0]
  var setValue = inputState[1]
  var inputRef = useRef(null)

  useEffect(function() {
    if (open) {
      setValue('')
      if (requiresInput) {
        setTimeout(function() {
          if (inputRef.current) inputRef.current.focus()
        }, 30)
      }
    }
  }, [open])

  useEffect(function() {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel && onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return function() { window.removeEventListener('keydown', onKey) }
  }, [open, onCancel])

  if (!open) return null

  function handleConfirm() {
    if (requiresInput && !allowEmptyInput && !String(value || '').trim()) return
    var clean = requiresInput ? String(value || '').slice(0, inputMaxLength).trim() : null
    onConfirm && onConfirm(clean)
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={function() { onCancel && onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div onClick={function(e) { e.stopPropagation() }} className="w-full max-w-md">
        <Panel padding="default" radius="xl" className="border border-outline-variant/30">
          <div className="flex items-start gap-3 mb-4">
            <Icon
              name={destructive ? 'warning' : 'help'}
              size={28}
              className={destructive ? 'text-error' : 'text-primary'}
            />
            <div className="flex-1 min-w-0">
              <h3 id="confirm-modal-title" className="font-display text-lg text-on-surface mb-1 uppercase tracking-tight">{title}</h3>
              {message && <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p>}
            </div>
          </div>

          {requiresInput && (
            <div className="mb-4">
              {inputLabel && (
                <label className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">{inputLabel}</label>
              )}
              <textarea
                ref={inputRef}
                value={value}
                onChange={function(e) { setValue(e.target.value) }}
                placeholder={inputPlaceholder}
                maxLength={inputMaxLength}
                rows={3}
                className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant/30 px-3 py-2 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary resize-none"
              />
              <div className="font-mono text-[10px] text-outline mt-1 text-right">{(value || '').length} / {inputMaxLength}</div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="secondary" size="md" onClick={function() { onCancel && onCancel() }}>{cancelLabel}</Btn>
            <Btn
              variant={destructive ? 'destructive' : 'primary'}
              size="md"
              onClick={handleConfirm}
              disabled={requiresInput && !allowEmptyInput && !String(value || '').trim()}
            >
              {confirmLabel}
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  )
}
