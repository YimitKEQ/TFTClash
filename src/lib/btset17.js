// Set 17 "Space Gods" - single source of truth for BrosephTech tools
// Sources: Riot Games TFT patch schedule 2026, Mobalytics Set 17 reveal

export var CURRENT_SET = {
  number: 17,
  name: 'Space Gods',
  fullName: 'Set 17: Space Gods',
  startDate: '2026-04-15',
  endDate: '2026-07-29',
  mechanic: 'Realm of the Gods',
  mechanicSummary: 'Choose Minor Blessings during carousels. Top-voted God grants a God Boon at 4-7. Pool of 9 Gods.',
};

export var PATCHES = [
  { id: '17.1', label: 'Patch 17.1', date: '2026-04-15', notes: 'Set 17 launch' },
  { id: '17.2', label: 'Patch 17.2', date: '2026-04-29', notes: 'First balance' },
  { id: '17.3', label: 'Patch 17.3', date: '2026-05-13', notes: '' },
  { id: '17.4', label: 'Patch 17.4', date: '2026-05-28', notes: 'Mid-set update' },
  { id: '17.5', label: 'Patch 17.5', date: '2026-06-10', notes: '' },
  { id: '17.6', label: 'Patch 17.6', date: '2026-06-24', notes: '' },
  { id: '17.7', label: 'Patch 17.7', date: '2026-07-15', notes: 'Set close' },
];

export var CHAMPIONS = [
  // 1-cost
  { name: 'Aatrox', cost: 1 },
  { name: 'Briar', cost: 1 },
  { name: 'Caitlyn', cost: 1 },
  { name: "Cho'Gath", cost: 1 },
  { name: 'Ezreal', cost: 1 },
  { name: 'Leona', cost: 1 },
  { name: 'Lissandra', cost: 1 },
  { name: 'Nasus', cost: 1 },
  { name: 'Poppy', cost: 1 },
  { name: "Rek'Sai", cost: 1 },
  { name: 'Talon', cost: 1 },
  { name: 'Teemo', cost: 1 },
  { name: 'Twisted Fate', cost: 1 },
  { name: 'Veigar', cost: 1 },
  // 2-cost
  { name: 'Akali', cost: 2 },
  { name: "Bel'Veth", cost: 2 },
  { name: 'Gnar', cost: 2 },
  { name: 'Gragas', cost: 2 },
  { name: 'Gwen', cost: 2 },
  { name: 'Jax', cost: 2 },
  { name: 'Jinx', cost: 2 },
  { name: 'Meepsie', cost: 2 },
  { name: 'Milio', cost: 2 },
  { name: 'Mordekaiser', cost: 2 },
  { name: 'Pantheon', cost: 2 },
  { name: 'Pyke', cost: 2 },
  { name: 'Zoe', cost: 2 },
  // 3-cost
  { name: 'Aurora', cost: 3 },
  { name: 'Diana', cost: 3 },
  { name: 'Fizz', cost: 3 },
  { name: 'Illaoi', cost: 3 },
  { name: "Kai'Sa", cost: 3 },
  { name: 'Lulu', cost: 3 },
  { name: 'Maokai', cost: 3 },
  { name: 'Miss Fortune', cost: 3 },
  { name: 'Ornn', cost: 3 },
  { name: 'Rhaast', cost: 3 },
  { name: 'Samira', cost: 3 },
  { name: 'Urgot', cost: 3 },
  { name: 'Viktor', cost: 3 },
  // 4-cost
  { name: 'Aurelion Sol', cost: 4 },
  { name: 'Corki', cost: 4 },
  { name: 'Karma', cost: 4 },
  { name: 'Kindred', cost: 4 },
  { name: 'LeBlanc', cost: 4 },
  { name: 'Master Yi', cost: 4 },
  { name: 'Nami', cost: 4 },
  { name: 'Nunu', cost: 4 },
  { name: 'Rammus', cost: 4 },
  { name: 'Riven', cost: 4 },
  { name: 'Tahm Kench', cost: 4 },
  { name: 'The Mighty Mech', cost: 4 },
  { name: 'Xayah', cost: 4 },
  // 5-cost
  { name: 'Bard', cost: 5 },
  { name: 'Blitzcrank', cost: 5 },
  { name: 'Fiora', cost: 5 },
  { name: 'Graves', cost: 5 },
  { name: 'Jhin', cost: 5 },
  { name: 'Morgana', cost: 5 },
  { name: 'Shen', cost: 5 },
  { name: 'Sona', cost: 5 },
  { name: 'Vex', cost: 5 },
  { name: 'Zed', cost: 5 },
];

export var TRAITS = [
  // Origins
  'Anima', 'Arbiter', 'Bulwark', 'Commander', 'Dark Lady', 'Dark Star',
  'Divine Duelist', 'Doomer', 'Eradicator', 'Factory New', 'Galaxy Hunter',
  'Gun Goddess', 'Mecha', 'Meeple', 'N.O.V.A.', 'Oracle', 'Party Animal',
  'Primordian', 'Psionic', 'Redeemer', 'Space Groove', 'Stargazer', 'Timebreaker',
  // Classes
  'Bastion', 'Brawler', 'Challenger', 'Channeler', 'Fateweaver', 'Marauder',
  'Replicator', 'Rogue', 'Shepherd', 'Sniper', 'Vanguard', 'Voyager',
];

// Set-specific terms used by scoreTitle and hashtag suggester.
export var MECHANIC_TERMS = [
  'space gods', 'realm of the gods', 'minor blessing', 'minor blessings',
  'god boon', 'god boons', 'set 17', '17.1', '17.2', '17.3', '17.4', '17.5', '17.6', '17.7',
  'stargazer', 'psionic', 'mecha', 'dark star', 'space groove', 'galaxy hunter',
  'aurelion sol', 'mighty mech', 'space', 'gods',
];

export function patchOnDate(iso) {
  for (var i = 0; i < PATCHES.length; i++) {
    if (PATCHES[i].date === iso) return PATCHES[i];
  }
  return null;
}

export function nextPatch(fromDate) {
  var anchor = fromDate || new Date();
  var anchorTime = new Date(anchor).getTime();
  for (var i = 0; i < PATCHES.length; i++) {
    var t = new Date(PATCHES[i].date + 'T00:00:00').getTime();
    if (t > anchorTime) return PATCHES[i];
  }
  return null;
}

export function champByName(name) {
  for (var i = 0; i < CHAMPIONS.length; i++) {
    if (CHAMPIONS[i].name === name) return CHAMPIONS[i];
  }
  return null;
}

export function findChampInText(text) {
  if (!text) return [];
  var lower = String(text).toLowerCase();
  var found = [];
  for (var i = 0; i < CHAMPIONS.length; i++) {
    if (lower.indexOf(CHAMPIONS[i].name.toLowerCase()) !== -1) {
      found.push(CHAMPIONS[i].name);
    }
  }
  return found;
}
