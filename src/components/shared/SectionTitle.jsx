export default function SectionTitle(props) {
  var eyebrow = props.eyebrow
  var title = props.title
  var accent = props.accent
  var description = props.description
  var action = props.action
  var align = props.align || 'left'
  var size = props.size || 'md'
  var className = props.className || ''

  var alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-left'
  var eyebrowClass = align === 'center' ? 'brand-eyebrow mx-auto' : 'brand-eyebrow'

  var titleClass = size === 'xl'
    ? 'font-headline text-3xl sm:text-5xl font-bold leading-[1.05]'
    : size === 'lg'
      ? 'font-headline text-2xl sm:text-4xl font-bold leading-tight'
      : 'font-headline text-xl sm:text-2xl font-bold leading-tight'

  var layout = action
    ? (align === 'center'
        ? 'flex flex-col items-center gap-4'
        : 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4')
    : 'flex flex-col ' + alignClass

  return (
    <div className={layout + ' mb-6 ' + className}>
      <div className={'flex flex-col ' + alignClass + ' gap-3'}>
        {eyebrow ? <span className={eyebrowClass}>{eyebrow}</span> : null}
        <h2 className={titleClass + ' text-on-surface'}>
          {title}
          {accent ? <span className="text-primary"> {accent}</span> : null}
        </h2>
        {description ? (
          <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={'flex flex-shrink-0 ' + (align === 'center' ? 'justify-center' : '')}>
          {action}
        </div>
      ) : null}
    </div>
  )
}
