// Hand-authored canonical positions for top Set 17 meta comps.
//
// Why: our heuristic positioning is necessarily generic. Real meta boards
// follow conventions that pure stat-inspection cannot recover -- e.g.
// Stargazer Xayah keeps Nunu front-center to body-block while Xayah sits
// far-corner, Mecha clusters tanks 2-deep to feed Galio's W shield.
//
// These are based on Set 17 PBE consensus boards (no scraped art / prose,
// just position grids from observation). Falls back to heuristic when a
// comp id is not in this map.
//
// Coordinate system matches positioning.js: row 0 = front (closest to
// enemy), row 3 = back. Cols 0..6, odd rows offset visually.

var CANONICAL = {
  // -------- S/OP tier headliners --------
  'stargazer-xayah': [
    { key: 'rammus',       row: 0, col: 1 },
    { key: 'nunu',         row: 0, col: 3, isCarry: true },
    { key: 'gnar',         row: 0, col: 5 },
    { key: 'mordekaiser',  row: 1, col: 2 },
    { key: 'jax',          row: 1, col: 3 },
    { key: 'rhaast',       row: 1, col: 4 },
    { key: 'bard',         row: 2, col: 1 },
    { key: 'jhin',         row: 3, col: 0 },
    { key: 'xayah',        row: 3, col: 6, isCarry: true },
  ],
  'graves-fast-9': [
    { key: 'maokai',       row: 0, col: 2 },
    { key: 'tahmkench',    row: 0, col: 3, isCarry: true },
    { key: 'shen',         row: 0, col: 4 },
    { key: 'aatrox',       row: 1, col: 1 },
    { key: 'fiora',        row: 1, col: 5 },
    { key: 'akali',        row: 2, col: 0 },
    { key: 'morgana',      row: 3, col: 0 },
    { key: 'vex',          row: 3, col: 3 },
    { key: 'graves',       row: 3, col: 6, isCarry: true },
  ],
  'invader-zed': [
    { key: 'maokai',       row: 0, col: 2 },
    { key: 'tahmkench',    row: 0, col: 3, isCarry: true },
    { key: 'shen',         row: 0, col: 4 },
    { key: 'aatrox',       row: 1, col: 1 },
    { key: 'fiora',        row: 1, col: 5 },
    { key: 'akali',        row: 2, col: 6 },
    { key: 'morgana',      row: 3, col: 0 },
    { key: 'vex',          row: 3, col: 3 },
    { key: 'zed',          row: 0, col: 6, isCarry: true },
  ],
  'samira-reroll': [
    { key: 'ornn',         row: 0, col: 1 },
    { key: 'nunu',         row: 0, col: 3, isCarry: true },
    { key: 'nasus',        row: 0, col: 5 },
    { key: 'jax',          row: 1, col: 2 },
    { key: 'rhaast',       row: 1, col: 4 },
    { key: 'jhin',         row: 3, col: 0 },
    { key: 'xayah',        row: 3, col: 1 },
    { key: 'samira',       row: 3, col: 6, isCarry: true },
  ],
  'mecha': [
    { key: 'urgot',        row: 0, col: 1 },
    { key: 'galio',        row: 0, col: 3, isCarry: true },
    { key: 'leona',        row: 0, col: 5 },
    { key: 'amumu',        row: 1, col: 2 },
    { key: 'malzahar',     row: 1, col: 4 },
    { key: 'ahri',         row: 2, col: 1 },
    { key: 'aurelionsol',  row: 3, col: 6, isCarry: true },
  ],
  'viktor-illaoi-reroll': [
    { key: 'illaoi',       row: 0, col: 3, isCarry: true },
    { key: 'cassiopeia',   row: 0, col: 1 },
    { key: 'malzahar',     row: 0, col: 5 },
    { key: 'kogmaw',       row: 1, col: 2 },
    { key: 'syndra',       row: 1, col: 4 },
    { key: 'viktor',       row: 3, col: 6, isCarry: true },
    { key: 'janna',        row: 3, col: 0 },
    { key: 'soraka',       row: 3, col: 1 },
  ],
  'dark-star': [
    { key: 'mordekaiser',  row: 0, col: 1 },
    { key: 'shen',         row: 0, col: 3 },
    { key: 'jarvaniv',     row: 0, col: 5 },
    { key: 'lux',          row: 1, col: 2 },
    { key: 'kayle',        row: 1, col: 4 },
    { key: 'leblanc',      row: 3, col: 1, isCarry: true },
    { key: 'lulu',         row: 3, col: 3 },
    { key: 'thresh',       row: 3, col: 5 },
  ],
  'meeple-veigar': [
    { key: 'gnar',         row: 0, col: 1 },
    { key: 'rammus',       row: 0, col: 3 },
    { key: 'nasus',        row: 0, col: 5 },
    { key: 'veigar',       row: 3, col: 3, isCarry: true },
    { key: 'lulu',         row: 3, col: 1 },
    { key: 'tristana',     row: 3, col: 5 },
    { key: 'corki',        row: 3, col: 6 },
    { key: 'poppy',        row: 1, col: 2 },
  ],
  'space-groove-nami': [
    { key: 'nasus',        row: 0, col: 2 },
    { key: 'rammus',       row: 0, col: 3 },
    { key: 'gnar',         row: 0, col: 4 },
    { key: 'taric',        row: 1, col: 3 },
    { key: 'nami',         row: 3, col: 3, isCarry: true },
    { key: 'sona',         row: 3, col: 1 },
    { key: 'karma',        row: 3, col: 5 },
    { key: 'morgana',      row: 3, col: 0 },
  ],
  'anima-viktor-reroll': [
    { key: 'briar',        row: 0, col: 2 },
    { key: 'mordekaiser',  row: 0, col: 3 },
    { key: 'shen',         row: 0, col: 4 },
    { key: 'leblanc',      row: 1, col: 5 },
    { key: 'syndra',       row: 1, col: 1 },
    { key: 'viktor',       row: 3, col: 6, isCarry: true },
    { key: 'janna',        row: 3, col: 0 },
    { key: 'soraka',       row: 3, col: 1 },
  ],
  'teemo-reroll': [
    { key: 'rammus',       row: 0, col: 1 },
    { key: 'gnar',         row: 0, col: 3 },
    { key: 'nasus',        row: 0, col: 5 },
    { key: 'teemo',        row: 3, col: 3, isCarry: true },
    { key: 'corki',        row: 3, col: 1 },
    { key: 'tristana',     row: 3, col: 5 },
    { key: 'lulu',         row: 2, col: 2 },
    { key: 'poppy',        row: 1, col: 3 },
  ],
  'meeple-corki': [
    { key: 'rammus',       row: 0, col: 1 },
    { key: 'gnar',         row: 0, col: 3 },
    { key: 'nasus',        row: 0, col: 5 },
    { key: 'corki',        row: 3, col: 6, isCarry: true },
    { key: 'tristana',     row: 3, col: 1 },
    { key: 'veigar',       row: 3, col: 3 },
    { key: 'lulu',         row: 2, col: 2 },
    { key: 'poppy',        row: 1, col: 3 },
  ],
  'kaisa-rogues': [
    { key: 'tahmkench',    row: 0, col: 2 },
    { key: 'shen',         row: 0, col: 3 },
    { key: 'maokai',       row: 0, col: 4 },
    { key: 'akali',        row: 1, col: 5 },
    { key: 'briar',        row: 1, col: 1 },
    { key: 'kaisa',        row: 3, col: 6, isCarry: true },
    { key: 'morgana',      row: 3, col: 0 },
    { key: 'vex',          row: 3, col: 3 },
  ],
  'pyke-gwen-reroll': [
    { key: 'pyke',         row: 0, col: 3, isCarry: true },
    { key: 'rammus',       row: 0, col: 1 },
    { key: 'tahmkench',    row: 0, col: 5 },
    { key: 'gwen',         row: 1, col: 4 },
    { key: 'mordekaiser',  row: 1, col: 2 },
    { key: 'jax',          row: 2, col: 5 },
    { key: 'akali',        row: 2, col: 1 },
  ],
  'primordian-reroll': [
    { key: 'briar',        row: 0, col: 2 },
    { key: 'cassiopeia',   row: 0, col: 3, isCarry: true },
    { key: 'mordekaiser',  row: 0, col: 4 },
    { key: 'kogmaw',       row: 3, col: 0 },
    { key: 'illaoi',       row: 1, col: 5 },
    { key: 'malzahar',     row: 3, col: 6 },
  ],
  'bonk-nasus': [
    { key: 'nasus',        row: 0, col: 3, isCarry: true },
    { key: 'gnar',         row: 0, col: 1 },
    { key: 'rammus',       row: 0, col: 5 },
    { key: 'jax',          row: 1, col: 2 },
    { key: 'rhaast',       row: 1, col: 4 },
    { key: 'mordekaiser',  row: 1, col: 3 },
    { key: 'lulu',         row: 3, col: 3 },
  ],
  'vex-ap-fast-9': [
    { key: 'tahmkench',    row: 0, col: 2 },
    { key: 'shen',         row: 0, col: 3 },
    { key: 'maokai',       row: 0, col: 4 },
    { key: 'morgana',      row: 1, col: 1 },
    { key: 'akali',        row: 1, col: 5 },
    { key: 'vex',          row: 3, col: 3, isCarry: true },
    { key: 'leblanc',      row: 3, col: 1 },
    { key: 'aurelionsol',  row: 3, col: 6 },
  ],
  'twisted-fate-reroll-2': [
    { key: 'rammus',       row: 0, col: 1 },
    { key: 'mordekaiser',  row: 0, col: 3 },
    { key: 'gnar',         row: 0, col: 5 },
    { key: 'twistedfate',  row: 3, col: 3, isCarry: true },
    { key: 'lulu',         row: 3, col: 1 },
    { key: 'morgana',      row: 3, col: 5 },
    { key: 'janna',        row: 3, col: 0 },
  ],
  'cho-ez-reroll': [
    { key: 'chogath',      row: 0, col: 3, isCarry: true },
    { key: 'cassiopeia',   row: 0, col: 1 },
    { key: 'malzahar',     row: 0, col: 5 },
    { key: 'ezreal',       row: 3, col: 3, isCarry: true },
    { key: 'janna',        row: 3, col: 0 },
    { key: 'soraka',       row: 3, col: 1 },
  ],
}

export function canonicalFor(compId) {
  return CANONICAL[compId] || null
}

export function hasCanonical(compId) {
  return Object.prototype.hasOwnProperty.call(CANONICAL, compId)
}
