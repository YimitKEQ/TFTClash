// Bridge module that exposes Donut 17 (Community Dragon) assets to BrosephTech tools.
// Used by tier lists, marketing tools, etc. so they can render real champion
// portraits and item icons instead of plain text chips.

import champsRaw from '../donut17/data/champions.json';
import itemsRaw from '../donut17/data/items.json';

export var BT_CHAMPIONS = champsRaw.map(function(c) {
  return {
    name: c.name,
    apiName: c.apiName,
    cost: c.cost,
    traits: c.traits || [],
    assets: c.assets || {},
    role: c.role || null,
  };
});

var CHAMP_BY_NAME = {};
BT_CHAMPIONS.forEach(function(c) { CHAMP_BY_NAME[c.name] = c; });
export function getChamp(name) {
  return CHAMP_BY_NAME[name] || null;
}

function pngIcon(icon) {
  if (!icon) return '';
  return String(icon).replace(/\.tex$/, '.png');
}

function shouldSkipName(n) {
  if (!n) return true;
  if (n.startsWith('@')) return true;
  if (n.startsWith('TFT_')) return true;
  if (n.startsWith('tft_')) return true;
  if (n.startsWith('game_item_displayname_')) return true;
  if (n === 'MissingNo') return true;
  if (n === 'Unusable Slot') return true;
  return false;
}

function dedupeByName(list) {
  var seen = {};
  var out = [];
  list.forEach(function(item) {
    if (seen[item.name]) return;
    seen[item.name] = true;
    out.push(item);
  });
  return out;
}

function shapeItem(raw) {
  return {
    apiName: raw.apiName,
    name: raw.name,
    desc: raw.desc || '',
    icon: pngIcon(raw.icon),
    unique: !!raw.unique,
  };
}

function classifyItem(raw) {
  var a = raw.apiName || '';
  if (a.startsWith('TFT17_Item_Artifact_')) {
    if (a.endsWith('_Radiant')) return null;
    return 'artifact';
  }
  if (a.startsWith('TFT17_Item_PsyOps_')) {
    if (a.endsWith('_Radiant')) return null;
    return 'set17';
  }
  if (a.startsWith('TFT17_AnimaSquadItem_')) {
    return 'set17';
  }
  if (a.indexOf('EmblemItem') !== -1) {
    return 'emblem';
  }
  if (a.startsWith('TFT_Item_')) {
    if (a.indexOf('Grant') !== -1) return null;
    if (a.indexOf('AddTrait') !== -1) return null;
    if (a.indexOf('FreeReroll') !== -1) return null;
    if (a.indexOf('Augment') !== -1) return null;
    if (a.indexOf('OneCost') !== -1) return null;
    if (a.indexOf('Random') !== -1) return null;
    if (a.indexOf('Lesser') !== -1) return null;
    if (a.indexOf('Component') !== -1) return null;
    if (a.indexOf('Anvil') !== -1) return null;
    if (a.indexOf('TomeOf') !== -1) return null;
    if (shouldSkipName(raw.name)) return null;
    return 'standard';
  }
  return null;
}

var groups = { standard: [], artifact: [], set17: [], emblem: [] };
itemsRaw.forEach(function(raw) {
  var cls = classifyItem(raw);
  if (!cls) return;
  if (shouldSkipName(raw.name)) return;
  if (!raw.icon) return;
  groups[cls].push(shapeItem(raw));
});
groups.standard = dedupeByName(groups.standard).sort(function(a, b) { return a.name.localeCompare(b.name); });
groups.artifact = dedupeByName(groups.artifact).sort(function(a, b) { return a.name.localeCompare(b.name); });
groups.set17 = dedupeByName(groups.set17).sort(function(a, b) { return a.name.localeCompare(b.name); });
groups.emblem = dedupeByName(groups.emblem).sort(function(a, b) { return a.name.localeCompare(b.name); });

export var BT_ITEM_GROUPS = [
  { id: 'standard', label: 'Standard', items: groups.standard },
  { id: 'artifact', label: 'Artifacts', items: groups.artifact },
  { id: 'set17', label: 'Set 17', items: groups.set17 },
  { id: 'emblem', label: 'Emblems', items: groups.emblem },
];

export var BT_ITEMS_ALL = [].concat(groups.standard, groups.artifact, groups.set17, groups.emblem);

var ITEM_BY_API = {};
BT_ITEMS_ALL.forEach(function(it) { ITEM_BY_API[it.apiName] = it; });
export function getItem(apiName) {
  return ITEM_BY_API[apiName] || null;
}
