// Fallback helper for images that 404 (tactics.tools CDN may not have
// all TFT17 assets during PBE). Returns a React onError handler that
// swaps the src to a cost-colored SVG placeholder.

export function makeImgFallback(cost) {
  return function (e) {
    var el = e && e.target
    if (!el || el.dataset.fallback === '1') return
    el.dataset.fallback = '1'
    var color = costColor(cost)
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="' + color + '" opacity="0.25"/><rect x="2" y="2" width="60" height="60" fill="none" stroke="' + color + '" stroke-width="2"/><text x="32" y="38" text-anchor="middle" fill="' + color + '" font-family="monospace" font-size="20">' + (cost || '?') + '</text></svg>'
    el.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }
}

export function costColor(cost) {
  if (cost === 1) return '#9aa0a6'
  if (cost === 2) return '#4ade80'
  if (cost === 3) return '#60a5fa'
  if (cost === 4) return '#c084fc'
  if (cost === 5) return '#fbbf24'
  return '#9d8e7c'
}
