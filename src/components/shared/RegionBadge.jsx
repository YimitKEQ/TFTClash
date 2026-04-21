import { REGION_META, normalizeRegion } from '../../lib/regions'

export default function RegionBadge({ region, size = 'sm', showFlag = true, showLabel = true, className = '' }) {
  var r = normalizeRegion(region)
  var meta = r && REGION_META[r] ? REGION_META[r] : null
  var color = meta ? meta.color : '#9AAABF'
  var label = meta ? meta.label : 'Unset'
  var flag = meta && showFlag ? meta.flag : ''

  var pad = size === 'lg' ? 'px-2.5 py-1 text-xs' : size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]'

  return (
    <span
      className={'inline-flex items-center gap-1 rounded font-sans uppercase tracking-widest border font-bold ' + pad + ' ' + className}
      style={{ color: color, borderColor: color + '44', backgroundColor: color + '1a' }}
      title={meta ? meta.full + ' server' : 'Region not set'}
    >
      {flag && <span className="text-[1em] leading-none">{flag}</span>}
      {showLabel && <span>{label}</span>}
    </span>
  )
}
