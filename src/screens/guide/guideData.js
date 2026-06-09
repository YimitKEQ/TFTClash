// All static content for the Climb Guide lives here so GuideScreen stays a
// thin composition layer. Hard numbers (shop odds, interest) are current as of
// the live set; the habits are evergreen.

export var CHAPTERS = [
  { id: 'anatomy', label: 'Anatomy of a Comp', icon: 'dashboard' },
  { id: 'habits', label: 'The Five Habits', icon: 'checklist' },
  { id: 'econ', label: 'Economy & Rolling', icon: 'savings' },
  { id: 'items', label: 'Itemization', icon: 'construction' },
  { id: 'positioning', label: 'Positioning', icon: 'grid_view' },
  { id: 'augments', label: 'Augments', icon: 'auto_awesome' },
  { id: 'mistakes', label: "Why You're Hardstuck", icon: 'warning' },
]

export var PILLARS = [
  {
    icon: 'target',
    label: 'Win Condition',
    title: 'Stage 3 Wins Lobbies',
    desc: 'Every choice on Stage 2 exists to set up one thing: a strong, two-starred board the moment Stage 3 begins.',
  },
  {
    icon: 'savings',
    label: 'Tempo',
    title: 'Board Over Gold',
    desc: 'Units are loaded with power early. Holding the right pairs beats hitting your gold interval one round sooner.',
  },
  {
    icon: 'visibility',
    label: 'Information',
    title: 'Scout Every Turn',
    desc: 'What to play, when to level, how to position. Every question on the board is answered by a five-second scout.',
  },
]

export var LESSONS = [
  {
    id: 'stage3',
    num: '01',
    eyebrow: 'The core idea',
    title: 'Stage 3 Is The Whole Game',
    lede: 'Stop treating Stage 2 like a race. Treat it like setup. If you walk into Stage 3 strong, almost nothing you did before it matters.',
    points: [
      'Stop leveling on Stage 2 just because you can. A level you do not need is gold and HP you will want for your Stage 3 board.',
      'Stop forcing a flawless win or loss streak. Mixed streaking is completely fine as long as Stage 3 is yours.',
      'Hold the units that build your strongest Stage 3 line, even pairs you are not playing yet, instead of selling for a slightly earlier interval.',
    ],
    take: 'It is okay to mix-streak Stage 2, as long as you win Stage 3.',
  },
  {
    id: 'tengold',
    num: '02',
    eyebrow: 'Early game',
    title: 'Do Not Rush Your First 10 Gold',
    lede: 'The old habit of selling everything to hit 10 gold as fast as possible is outdated. Modern units do too much damage to throw away for one extra round of interest.',
    points: [
      'Hold strong openers and connectors instead of dumping them for an early interval. A held pair often out-values the gold you would have banked.',
      'You make gold by winning. A clean win streak pays better than an early interest break and keeps your HP bar full.',
      'Aim to reach the 10 gold threshold by the first carousel at the latest. Delaying it a round or two to keep a strong board is a good trade.',
    ],
    take: 'A strong board prints gold. An empty bench at 10 gold does not.',
  },
  {
    id: 'lossstreak',
    num: '03',
    eyebrow: 'Streak myths',
    title: 'The Perfect Loss Streak Is A Trap',
    lede: 'Giga open-forting for a flawless loss streak pays far less than it used to. Unless your comp is built to lose on purpose, it is rarely the right plan.',
    points: [
      'The gold from a deep loss streak was cut down sets ago. The HP you burn to chase it is no longer worth the payout.',
      'Hold your units, take the soft three-loss, and keep your board healthy instead of intentionally fielding nothing.',
      'If your board feels strong after the first carousel, flip it. Win the next two and roll into Krugs with tempo instead of bleeding out.',
    ],
    take: 'Loss-streak on purpose only with a loss-streak comp. Otherwise, hold and pivot.',
  },
  {
    id: 'augments',
    num: '04',
    eyebrow: 'Augments',
    title: 'Take Tempo, Not Always Econ',
    lede: 'The classic "one econ, one item, one combat" is a fine baseline, but the order matters less than the spot you are in. When you have a strong opener, lean into tempo.',
    points: [
      'Good start with a direction and a two-star? Favor item and combat augments. Early items mean early damage, which means a win streak that funds itself.',
      'Homeless with no pairs and no plan? That is when econ first makes sense. Bank gold, scout the uncontested line, and hold toward a strong Stage 3.',
      'The 4-2 augment is your natural econ window if you might not hit. After streaking on tempo augments, econ here lets you stabilize and push level 9.',
    ],
    take: 'Strong opener favors item and combat. Take econ when you are lost, or save it for 4-2.',
  },
  {
    id: 'scout',
    num: '05',
    eyebrow: 'The free LP',
    title: 'Scout Every Single Turn',
    lede: 'This is the most boring advice in TFT and the reason most people are stuck. Every decision you agonize over is already answered on someone else’s board.',
    points: [
      'What do I play? Scout the lobby and find the line nobody else is contesting.',
      'Do I level here? Scout the boards you are about to fight and check if leveling actually changes the result.',
      'How do I position? Scout your next opponent and place against their board, not against a memory of last round.',
    ],
    take: 'You can climb a full rank just by scouting before every single fight.',
  },
]

// Interest: one gold per ten in the bank, capped at five.
export var INTEREST = [
  { gold: '10', bonus: '+1' },
  { gold: '20', bonus: '+2' },
  { gold: '30', bonus: '+3' },
  { gold: '40', bonus: '+4' },
  { gold: '50', bonus: '+5' },
]

// Shop odds per slot, by level. Current live-set values.
export var SHOP_ODDS_COLS = [
  { cost: '1', cls: 'text-slate-300' },
  { cost: '2', cls: 'text-emerald-400' },
  { cost: '3', cls: 'text-sky-400' },
  { cost: '4', cls: 'text-violet-400' },
  { cost: '5', cls: 'text-amber-400' },
]

export var SHOP_ODDS = [
  { lvl: 2, odds: ['100', '-', '-', '-', '-'] },
  { lvl: 3, odds: ['75', '25', '-', '-', '-'] },
  { lvl: 4, odds: ['55', '30', '15', '-', '-'] },
  { lvl: 5, odds: ['45', '33', '20', '2', '-'] },
  { lvl: 6, odds: ['30', '40', '25', '5', '-'] },
  { lvl: 7, odds: ['19', '30', '40', '10', '1'] },
  { lvl: 8, odds: ['15', '20', '32', '30', '3'] },
  { lvl: 9, odds: ['10', '17', '25', '33', '15'] },
  { lvl: 10, odds: ['5', '10', '20', '40', '25'] },
  { lvl: 11, odds: ['1', '2', '12', '50', '35'] },
]

export var ODDS_NOTES = [
  'Level 6 is the 2-cost peak (40%). It is where reroll boards slow-roll for 2-cost three-stars.',
  'Level 7 is the 3-cost peak (40%). Slow-roll here for 3-cost carries.',
  'Level 8 is the 4-cost spike (30% a slot, about a 72% chance to see one per shop). The main rolldown for standard comps.',
  'Level 9 is the only realistic level to find 5-costs (15%), and 4-costs peak there at 33%.',
]

// A default leveling cadence. Reroll boards ignore this on purpose.
export var LEVEL_MAP = [
  { stage: '2-1', move: 'Level 4', detail: 'Open your board. Do not roll yet.' },
  { stage: '2-5', move: 'Level 5', detail: 'A little board strength before Krugs.' },
  { stage: '3-2', move: 'Level 6', detail: 'First real power spike. Stabilize here.' },
  { stage: '4-1', move: 'Level 7', detail: 'Standard comps level on the way to 8.' },
  { stage: '4-5', move: 'Level 8', detail: 'The main rolldown for most boards. Hit your units.' },
  { stage: '6-1', move: 'Level 9', detail: 'Once stable, push for the top-end carries.' },
]

export var ROLL_RULES = [
  {
    icon: 'lock',
    title: 'Protect your interest',
    text: 'Every 10 gold in the bank is one bonus gold a round, up to five at fifty. Rolling below 50 for no reason throws away free income. Stay above it unless you have a plan.',
  },
  {
    icon: 'sync',
    title: 'Slow-roll for 2 and 3 costs',
    text: 'Hunting a 2-cost three-star? Slow-roll at level 6. A 3-cost carry? Level 7. Roll five or ten at a time down to about thirty so interest keeps ticking.',
  },
  {
    icon: 'bolt',
    title: 'Roll down for 4 costs',
    text: 'Most 4-cost boards level to 8 and commit around fifty gold to find their units, then stop and rebuild. Level 8 is where 4-costs jump to 30% a slot.',
  },
  {
    icon: 'health_and_safety',
    title: 'Stabilize before you die',
    text: 'Below roughly 40 HP with a weak board, roll to survive even if it feels inefficient. A dead player gets 8th. A low player who stabilizes can still top 4.',
  },
]

// Real component icons live in public/guide/components, pulled from official assets.
export var COMPONENTS = [
  { file: 'bfsword', name: 'B.F. Sword' },
  { file: 'recurvebow', name: 'Recurve Bow' },
  { file: 'rod', name: 'Needlessly Large Rod' },
  { file: 'tear', name: 'Tear of the Goddess' },
  { file: 'chainvest', name: 'Chain Vest' },
  { file: 'negatron', name: 'Negatron Cloak' },
  { file: 'giantsbelt', name: "Giant's Belt" },
  { file: 'gloves', name: 'Sparring Gloves' },
]

// TFT cost colors (1-5), used for unit borders and table headers.
export var COST_COLORS = {
  1: '#9aa4b2',
  2: '#11b288',
  3: '#2c8fd6',
  4: '#b65ad6',
  5: '#e8a838',
}

// Completed example items (best-in-slot for an AD carry). Real icons in public/guide/items.
export var COMPLETED_ITEMS = [
  { file: 'infinityedge', name: 'Infinity Edge' },
  { file: 'lastwhisper', name: 'Last Whisper' },
  { file: 'guinsoos', name: "Guinsoo's Rageblade" },
  { file: 'bloodthirster', name: 'Bloodthirster' },
]

// An example coherent Set 17 board (a Sniper line) used to show how a comp reads:
// real units, real shared traits, sensible positioning. Illustrative, not a meta claim.
export var COMP = {
  name: 'Snipers',
  level: 8,
  tagline: 'Tanks hold the front, snipers line the back, every carry item stacked on one threat.',
  // Active traits, computed from the units below against real Set 17 breakpoints.
  // Sniper [2/3/4] -> 5 units is max tier. Stargazer [3/5/7] active at 3. Vanguard [2/4/6] active at 2.
  traits: [
    { file: 'sniper', name: 'Sniper', count: 5, hot: true },
    { file: 'stargazer', name: 'Stargazer', count: 3, hot: false },
    { file: 'vanguard', name: 'Vanguard', count: 2, hot: false },
  ],
  // row 0 = front line, row 3 = back line; col 0-6 left to right
  units: [
    { file: 'leona', name: 'Leona', cost: 1, row: 0, col: 2, star: 2, role: 'Frontline', traits: ['Arbiter', 'Vanguard'] },
    { file: 'nunu', name: 'Nunu & Willump', cost: 4, row: 0, col: 3, star: 2, label: 'Tank', role: 'Main Tank', traits: ['Stargazer', 'Vanguard'] },
    { file: 'jax', name: 'Jax', cost: 2, row: 0, col: 4, star: 2, role: 'Frontline', traits: ['Stargazer', 'Bastion'] },
    { file: 'gnar', name: 'Gnar', cost: 2, row: 3, col: 2, star: 2, role: 'Sniper', traits: ['Meeple', 'Sniper'] },
    { file: 'samira', name: 'Samira', cost: 3, row: 3, col: 4, star: 2, role: 'Sniper', traits: ['Space Groove', 'Sniper'] },
    { file: 'ezreal', name: 'Ezreal', cost: 1, row: 3, col: 5, star: 2, role: 'Sniper', traits: ['Timebreaker', 'Sniper'] },
    { file: 'xayah', name: 'Xayah', cost: 4, row: 3, col: 1, star: 2, role: 'Secondary Carry', traits: ['Stargazer', 'Sniper'] },
    { file: 'jhin', name: 'Jhin', cost: 5, row: 3, col: 0, star: 3, label: 'Carry', role: 'Main Carry', traits: ['Dark Star', 'Eradicator', 'Sniper'], items: ['infinityedge', 'lastwhisper', 'bloodthirster'] },
  ],
}

// Replaces the old three pillar cards with an editorial statement row.
export var PRINCIPLES = [
  { n: '01', word: 'Setup', line: 'Stage 2 exists for one reason: to build a strong Stage 3.' },
  { n: '02', word: 'Tempo', line: 'A live board prints gold. Hold units over hitting interest a round early.' },
  { n: '03', word: 'Reads', line: 'Every decision you agonize over is answered by a five-second scout.' },
]

// Top players worth studying. Avatars are their public channel images; links go to Twitch.
export var CREATORS = [
  { file: 'mortdog', name: 'Mortdog', handle: 'Mortdog', role: 'Game Director', cost: 5, feature: true, learn: 'He literally balances the game. His patch rundowns tell you what is strong before the lobby figures it out.' },
  { file: 'dishsoap', name: 'Dishsoap', handle: 'Dishsoap', role: 'Top NA Player', cost: 5, feature: true, learn: 'A clinic on fundamentals. Watch how he reads what is open and never forces a dead line.' },
  { file: 'frodan', name: 'Frodan', handle: 'Frodan', role: 'Caster & Analyst', cost: 4, learn: 'The voice of high-level TFT. Best for the macro and the why behind every decision.' },
  { file: 'k3soju', name: 'k3soju', handle: 'K3Soju', role: 'Educational Streamer', cost: 4, learn: 'Talks through every call live. Great for learning lines, pivots, and when to commit.' },
  { file: 'wasianiverson', name: 'Wasianiverson', handle: 'wasianiverson', role: 'Pro / Worlds Qualifier', cost: 4, learn: 'A 2x Regionals winner. Watch his ranked grind for clean, disciplined, no-griefing climbing.' },
  { file: 'setsuko', name: 'Setsuko', handle: 'Setsuko', role: 'Consistency Machine', cost: 3, learn: 'Rarely bottoms out. Study his econ discipline and how he always fields a board.' },
  { file: 'robinsongz', name: 'Robinsongz', handle: 'Robinsongz', role: 'Aggressive Lines', cost: 3, learn: 'Fearless, fast rolldowns. Learn the spots where pushing tempo is the correct play.' },
  { file: 'brosephtft', name: 'BrosephTFT', handle: 'BrosephTFT', role: 'Content & Coaching', cost: 3, learn: 'Breaks the game down for improvers. Great for digestible, climb-focused lessons.' },
]

export var ITEM_RULES = [
  {
    icon: 'flash_on',
    title: 'Slam early, win now',
    desc: 'A strong item on your carry by Stage 3 wins more games than a perfect build that arrives on Stage 5. Damage now beats damage never.',
  },
  {
    icon: 'verified',
    title: 'Know your BIS, do not grief for it',
    desc: 'Best-in-slot is the ideal build for your carry. Aim for it, but never bleed twenty HP sitting on components waiting for the dream.',
  },
  {
    icon: 'shield',
    title: 'Items go on the right body',
    desc: 'Carry items on one carry, tank items on one tank. Splitting items across three units gives you three weak units instead of one threat.',
  },
]

export var ARCHETYPES = [
  {
    icon: 'trending_up',
    name: 'Standard Tempo',
    desc: 'Strong board, level on cadence, roll down at 4-1 or 4-5 for a level 8 board. Your default when no strong signal points elsewhere.',
  },
  {
    icon: 'rocket_launch',
    name: 'Fast 8',
    desc: 'Trade early econ to rush level 8 and high-cost carries. Needs a healthy HP bar and econ augments to fund it.',
  },
  {
    icon: 'casino',
    name: 'Reroll',
    desc: 'Slow-roll at level 6 or 7 to three-star key low-cost units. Commit early, hold every pair, and do not level past your breakpoint.',
  },
]

export var AUG_QUESTIONS = [
  {
    q: 'Can I actually play it here?',
    a: 'A combat augment for a trait nobody is feeding you is a trap. Pick the augment that fits a line that is open in this lobby.',
  },
  {
    q: 'Is it gold or tempo positive?',
    a: 'Econ augments pay off over the whole game. Item and combat augments spike your power right now. Match the choice to whether you need to streak or to scale.',
  },
  {
    q: 'Does it hit a timing I care about?',
    a: 'The best augments spike a moment that matters: your 3-2, your level 8 rolldown, your reroll breakpoint. Power with no timing behind it is wasted.',
  },
]

export var MISTAKES = [
  {
    icon: 'block',
    t: 'Forcing one comp every game',
    d: 'Hard-forcing the same line no matter what the lobby feeds you. The best players play what is open, not what they planned in queue.',
  },
  {
    icon: 'casino',
    t: 'Rolling on tilt',
    d: 'Dumping gold to zero with no breakpoint because you lost a fight. Decide your roll spot in advance and stop the moment you hit your board.',
  },
  {
    icon: 'inventory_2',
    t: 'Holding components for BIS',
    d: 'Sitting on items hoping for the perfect build while you bleed out. Slam a strong item by Stage 3 instead.',
  },
  {
    icon: 'visibility_off',
    t: 'Positioning on autopilot',
    d: 'Never scouting, dropping the same board every round. One look at the next opponent changes where your carry and tank belong.',
  },
  {
    icon: 'trending_down',
    t: 'Greeding econ while you die',
    d: 'Sitting on 50 gold at 30 HP to protect interest. Interest is worthless if you are dead. Spend to survive, then rebuild.',
  },
  {
    icon: 'stairs',
    t: 'Leveling with no reason',
    d: 'Hitting the level button on Stage 2 just because you can, then being weak with an empty bench. Level to win a fight or unlock a spike, not on reflex.',
  },
]

export var CHECKLIST = [
  { stage: '2-1', note: 'Keep strong pairs and connectors. Do not over-level. Take a tempo augment if your start is good.' },
  { stage: '2-3', note: 'Hit 10 gold by the first carousel at the latest. Win-streak if the board allows it.' },
  { stage: '3-2', note: 'This is the fight that matters. Be two-starred and strong. Lean item or combat again unless you are losing anyway.' },
  { stage: '4-2', note: 'Your econ window. Stabilize, roll if you need the board, and set up the climb to level 9.' },
  { stage: 'Every turn', note: 'Scout. Then position your tank in front of their carry.' },
]
