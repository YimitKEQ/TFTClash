import { resolveIconName } from '../../lib/iconAliases.js';

// Renders a Material Symbols Outlined glyph. Legacy Bootstrap/Tabler names are
// healed to their Material Symbols equivalents via resolveIconName (see
// lib/iconAliases.js) so they render as icons instead of raw text.
export default function Icon({ name, children, fill = false, size = 24, className = '' }) {
  // Icons may be passed via the `name` prop OR as children (<Icon>home</Icon>).
  // Resolve whichever is used through the alias map so legacy names heal in both
  // cases (achievements etc. pass the name as children).
  var raw = name != null ? name : children;
  var resolved = resolveIconName(raw);
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`
      }}
    >
      {resolved}
    </span>
  )
}
