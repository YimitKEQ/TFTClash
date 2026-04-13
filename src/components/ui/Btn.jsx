const variants = {
  primary: 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 hover:shadow-[0_0_30px_rgba(232,168,56,0.3)] hover:scale-[1.02] active:scale-95',
  secondary: 'bg-surface-container-high text-on-surface border border-outline-variant/15 hover:bg-surface-container-highest',
  ghost: 'text-on-surface/60 hover:text-on-surface hover:bg-white/5',
  destructive: 'bg-error-container/20 text-error border border-error/20 hover:bg-error-container/30',
  tertiary: 'bg-tertiary/10 text-tertiary border border-tertiary/30 hover:bg-tertiary/20',
  link: 'text-primary hover:underline underline-offset-4 decoration-2',
}

const sizes = {
  sm: 'py-2 px-4 text-xs min-h-[36px]',
  md: 'py-3 px-6 text-sm min-h-[44px]',
  lg: 'py-4 px-8 text-sm min-h-[52px]',
  xl: 'py-5 w-full text-sm min-h-[56px]',
}

export default function Btn({ children, variant = 'primary', size = 'md', icon, iconPosition = 'left', loading = false, disabled = false, className = '', ...props }) {
  var base = 'inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'
  if (variant === 'link') {
    base = 'inline-flex items-center gap-1 font-label font-bold uppercase tracking-widest text-xs transition-all duration-200 disabled:opacity-50'
  }
  var variantClass = variants[variant] || variants.primary
  var sizeClass = variant === 'link' ? '' : (sizes[size] || sizes.md)
  return (
    <button
      className={base + ' ' + variantClass + ' ' + sizeClass + ' ' + className}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {!loading && icon && iconPosition === 'left' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
      {children}
      {!loading && icon && iconPosition === 'right' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
    </button>
  )
}
