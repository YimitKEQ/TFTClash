import Icon from '../../components/ui/Icon'

function shortDate(input) {
  if (!input) return ''
  var d = new Date(input)
  if (isNaN(d.getTime())) return ''
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}

// Dropdown of finished clashes. Value is the tournament id. Calls onChange(id).
export default function ClashSelector(props) {
  var clashes = props.clashes || []
  var value = props.value || ''
  var onChange = props.onChange || function () {}
  if (clashes.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Icon name="event" size={16} className="text-on-surface/40" />
      <div className="relative">
        <select
          value={value}
          onChange={function (e) { onChange(e.target.value) }}
          className="appearance-none bg-surface-container border border-outline-variant/20 rounded-lg pl-3 pr-9 py-2 text-sm text-on-surface font-label uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60"
        >
          {clashes.map(function (c) {
            var d = shortDate(c.date)
            return (
              <option key={c.id} value={String(c.id)}>
                {(c.name || 'Clash') + (d ? ' - ' + d : '')}
              </option>
            )
          })}
        </select>
        <Icon name="expand_more" size={18} className="text-on-surface/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  )
}
