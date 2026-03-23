import Icon from './Icon'

const toastStyles = {
  success: 'border-l-4 border-l-success bg-success/5',
  error: 'border-l-4 border-l-error bg-error/5',
  info: 'border-l-4 border-l-tertiary bg-tertiary/5',
  warning: 'border-l-4 border-l-warning bg-warning/5',
}

const toastIcons = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

export default function Toast({ message, type = 'info', onDismiss }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-sm bg-surface-container-low border border-outline-variant/10 ${toastStyles[type] || toastStyles.info}`}>
      <Icon name={toastIcons[type] || 'info'} size={20} className={type === 'success' ? 'text-success' : type === 'error' ? 'text-error' : type === 'warning' ? 'text-warning' : 'text-tertiary'} />
      <span className="flex-1 text-sm text-on-surface">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-on-surface/40 hover:text-on-surface transition-colors">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
