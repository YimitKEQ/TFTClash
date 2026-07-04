// Original reference content for the /riftbound wiki page. Written from
// scratch based on publicly documented Riftbound TCG rules and mechanics -
// not copied from any single source.

export var RIFTBOUND_OVERVIEW = {
  tagline: 'The League of Legends Trading Card Game',
  blurb: 'Riftbound is Riot Games\' physical and digital trading card game set in the League of Legends universe. Two to four players each build a deck around a Legend, then fight to control Battlefields until someone crosses the score threshold first.',
}

export var WIN_CONDITION = {
  title: 'How You Win',
  points: [
    'A standard 1v1 match is a race to 8 points. Team play (2v2) raises the target to 11.',
    'You score points by moving your Units onto a Battlefield and holding it into the start of your next turn.',
    'Battlefields can change hands mid-match, so the lead swings on tempo and combat trades, not just raw board size.',
  ],
}

export var CARD_TYPES = [
  {
    id: 'legend',
    icon: 'auto_awesome',
    name: 'Legend',
    desc: 'The centerpiece of your deck. Your Legend sets your Champion and the Domains (colors) everything else is built around. Exactly one per deck, so the choice defines your whole game plan.',
  },
  {
    id: 'champion',
    icon: 'military_tech',
    name: 'Champion',
    desc: 'A powerful unit tied to your Legend, usually your strongest piece on the board and the centerpiece of your late-game plays.',
  },
  {
    id: 'unit',
    icon: 'groups',
    name: 'Unit',
    desc: 'Your army. Units move between locations and your Base, fight in combat, and are what actually stands on a Battlefield to score you points.',
  },
  {
    id: 'spell',
    icon: 'bolt',
    name: 'Spell',
    desc: 'A one-shot effect - damage, a buff, a counter, a disruption - that resolves immediately and then goes to the trash.',
  },
  {
    id: 'gear',
    icon: 'shield',
    name: 'Gear',
    desc: 'Persistent equipment that stays at your Base. Gear does not move or fight on its own, but gives your Units and plays an ongoing edge for as long as it stays in play.',
  },
  {
    id: 'battlefield',
    icon: 'flag',
    name: 'Battlefield',
    desc: 'The locations you are actually fighting over. Controlling one when your turn comes back around is what converts board presence into real score.',
  },
  {
    id: 'rune',
    icon: 'diamond',
    name: 'Rune',
    desc: 'Your resource system, kept in its own 12-card Rune deck. Each turn you draw two - turn a Rune sideways for a normal cost, or return it to the deck to fuel your biggest plays.',
  },
]

// The six Domains ("colors"). Descriptions and the "identity" line are
// original summaries of the publicly documented archetype identities.
export var DOMAINS = [
  { id: 'fury', name: 'Fury', color: '#E5484D', identity: 'All-out aggression', desc: 'Fury plays fast and lives in the moment. Its signature mechanic is discard - trading cards from your hand for immediate, powerful payoff.' },
  { id: 'calm', name: 'Calm', color: '#2FB380', identity: 'Reactive control', desc: 'Calm wins by responding, not leading. Expect movement tricks, combat tricks, and ways to counter or undercut whatever the opponent commits to.' },
  { id: 'mind', name: 'Mind', color: '#3B82F6', identity: 'Setup and card advantage', desc: 'Mind is about planning several turns ahead. It leans on effects that pay off later and on drawing more cards than the opponent.' },
  { id: 'body', name: 'Body', color: '#F2994A', identity: 'Ramp', desc: 'Body accelerates you past the normal Rune curve, generating extra resources so your bigger plays land ahead of schedule.' },
  { id: 'chaos', name: 'Chaos', color: '#9B59B6', identity: 'Recursion', desc: 'Chaos gets more out of cards you\'ve already used, pulling them back from the trash to squeeze extra value out of a single resource.' },
  { id: 'order', name: 'Order', color: '#E8C93B', identity: 'Go-wide', desc: 'Order floods the board with Units and rallies them together, treating individual units as expendable in favor of the collective push.' },
]

export var DECKBUILDING_BASICS = {
  title: 'Deckbuilding, In Short',
  points: [
    'Main deck: at least 40 cards, built around your Legend\'s two Domains.',
    'Rune deck: exactly 12 Runes, matching your Legend\'s Domains.',
    'Champion: your deck includes the Champion tied to your chosen Legend.',
  ],
}

export var GLOSSARY = [
  { term: 'Base', def: 'Your home zone. Gear stays here, and it\'s where Units return to before pushing back out to a Battlefield.' },
  { term: 'Trash', def: 'The discard pile. Spells go here after resolving; some Chaos effects can bring cards back from it.' },
  { term: 'Domain', def: 'One of the six colors (Fury, Calm, Mind, Body, Chaos, Order). Your Legend determines which two you build around.' },
  { term: 'Might', def: 'A Unit\'s combat strength - what it brings to a fight over a Battlefield.' },
]

export var TIER_LABELS = {
  S: { label: 'Tier S', desc: 'Format-defining. Expected to top cut and contend for the win in high-stakes events.' },
  1: { label: 'Tier 1', desc: 'Strong contender for a top 16-32 finish; usually a win or two short of top 8.' },
  2: { label: 'Tier 2', desc: 'Competes for top 64 with an experienced pilot who knows the legend and the metagame well.' },
  3: { label: 'Tier 3', desc: 'Can spike a good run when the matchups and draws line up, but not a consistent top performer.' },
}

export var TIER_ORDER = ['S', '1', '2', '3']
