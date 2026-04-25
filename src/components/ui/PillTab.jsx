import Icon from './Icon'

export default function PillTab({
  children,
  active = false,
  onClick,
  icon,
  iconSize = 18,
  iconPosition = 'left',
  className = '',
  type = 'button',
  ...props
}) {
  var base = 'flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-full border font-label text-sm font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
  var state = active
    ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
    : 'bg-surface-container-low/40 border-outline-variant/10 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low'
  var combined = base + ' ' + state + ' ' + className

  var iconNode = icon ? (
    <Icon
      name={icon}
      size={iconSize}
      fill={active}
      className={active ? 'text-primary' : 'text-on-surface/50'}
    />
  ) : null

  return (
    <button type={type} onClick={onClick} className={combined} {...props}>
      {iconNode && iconPosition === 'left' ? iconNode : null}
      {children}
      {iconNode && iconPosition === 'right' ? iconNode : null}
    </button>
  )
}

export function PillTabGroup({ children, align = 'center', className = '' }) {
  var alignClass = align === 'start'
    ? 'justify-start'
    : align === 'between'
      ? 'justify-between'
      : 'justify-start sm:justify-center'
  var combined = 'flex ' + alignClass + ' gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 ' + className
  return <div className={combined}>{children}</div>
}
