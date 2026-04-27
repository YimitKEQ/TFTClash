import Icon from './Icon'

const toastTone = {
  success: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success' },
  error: { bg: 'bg-error/10', border: 'border-error/30', text: 'text-error' },
  info: { bg: 'bg-tertiary/10', border: 'border-tertiary/30', text: 'text-tertiary' },
  warning: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning' },
}

const toastIcons = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

export default function Toast({ message, type = 'info', onDismiss }) {
  var tone = toastTone[type] || toastTone.info
  var iconName = toastIcons[type] || 'info'
  return (
    <div className={'flex items-center gap-3 p-4 rounded border ' + tone.bg + ' ' + tone.border}>
      <Icon name={iconName} size={20} className={tone.text + ' flex-shrink-0'} />
      <span className="flex-1 text-sm text-on-surface">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss notification" className="text-on-surface/40 hover:text-on-surface transition-colors flex-shrink-0">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
