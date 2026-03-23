const variants = {
  primary: 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95',
  secondary: 'bg-surface-variant/20 border border-outline-variant/15 hover:bg-surface-variant',
  ghost: 'text-on-surface/60 hover:text-on-surface hover:bg-white/5',
  destructive: 'bg-error-container/20 text-error border border-error/20',
}

const sizes = {
  sm: 'py-2 px-4 text-xs',
  md: 'py-3 px-6 text-sm',
  lg: 'py-4 px-8 text-sm',
  xl: 'py-5 w-full text-sm',
}

export default function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`rounded-full font-sans font-bold uppercase tracking-widest transition-all duration-300 ${variants[variant] || ''} ${sizes[size] || ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
