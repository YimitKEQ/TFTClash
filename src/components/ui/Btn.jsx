const variants = {
  primary: 'bg-primary/10 border border-primary/30 text-primary shadow-sm shadow-primary/10 hover:bg-primary/20 hover:border-primary/50 hover:shadow-md hover:shadow-primary/20 active:scale-[0.98]',
  secondary: 'bg-surface-container-low/40 border border-outline-variant/10 text-on-surface/80 hover:text-on-surface hover:bg-surface-container-low hover:border-outline-variant/20 active:scale-[0.98]',
  ghost: 'text-on-surface/60 hover:text-on-surface hover:bg-white/5',
  destructive: 'bg-error/10 border border-error/30 text-error hover:bg-error/20 hover:border-error/50 active:scale-[0.98]',
  tertiary: 'bg-tertiary/10 border border-tertiary/30 text-tertiary hover:bg-tertiary/20 hover:border-tertiary/50 active:scale-[0.98]',
  link: 'text-primary hover:underline underline-offset-4 decoration-2',
}

const sizes = {
  sm: 'py-2 px-4 text-xs min-h-[44px]',
  md: 'py-3 px-6 text-sm min-h-[44px]',
  lg: 'py-4 px-8 text-sm min-h-[52px]',
  xl: 'py-5 w-full text-sm min-h-[56px]',
}

export default function Btn({ children, variant = 'primary', size = 'md', icon, iconPosition = 'left', loading = false, disabled = false, className = '', href, ...props }) {
  var focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
  var base = 'inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-widest transition-all duration-300 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ' + focusRing
  if (variant === 'link') {
    base = 'inline-flex items-center gap-1 font-label font-bold uppercase tracking-widest text-xs transition-all duration-200 motion-reduce:transition-none disabled:opacity-50 ' + focusRing
  }
  var variantClass = variants[variant] || variants.primary
  var sizeClass = variant === 'link' ? '' : (sizes[size] || sizes.md)
  var combined = base + ' ' + variantClass + ' ' + sizeClass + ' ' + className

  var inner = (
    <>
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {!loading && icon && iconPosition === 'left' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
      {children}
      {!loading && icon && iconPosition === 'right' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
    </>
  )

  if (href) {
    var isExternal = href.indexOf('http') === 0 || href.indexOf('mailto:') === 0
    var anchorProps = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    return (
      <a href={href} className={combined + ' no-underline'} {...anchorProps} {...props}>
        {inner}
      </a>
    )
  }

  return (
    <button className={combined} disabled={disabled || loading} {...props}>
      {inner}
    </button>
  )
}
