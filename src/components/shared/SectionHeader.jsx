export default function SectionHeader({ eyebrow, title, description, action, align = 'left', className = '' }) {
  var alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start'
  var outerLayout
  if (action && align === 'center') {
    outerLayout = 'flex flex-col items-center gap-4'
  } else if (action) {
    outerLayout = 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'
  } else {
    outerLayout = 'flex flex-col ' + alignClass
  }
  var actionAlign = align === 'center' ? 'justify-center' : ''

  return (
    <div className={outerLayout + ' mb-6 ' + className}>
      <div className={'flex flex-col ' + alignClass}>
        {eyebrow ? (
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface leading-tight">
          {title}
        </h2>
        {description ? (
          <p className="font-body text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={'flex ' + actionAlign + ' flex-shrink-0'}>
          {action}
        </div>
      ) : null}
    </div>
  )
}
