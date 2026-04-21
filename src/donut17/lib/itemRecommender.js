// Item recommendation engine.
//
// We have ZERO authored item data: champions[].bis is empty, comp_lines
// only stores augments. So we synthesize recommendations from:
//   1. Champion stats (range, HP, damage)
//   2. Champion traits (Bastion/Brawler/Vanguard -> tank items, etc.)
//   3. Ability variable scaling (ADDamage vs APDamage magnitude)
//   4. Hand-curated overrides for the headline meta carries (Set 17)
//
// The result is a {primary[], alts[], reason, archetype} per champion.
// Item objects come from items.json (passed in as itemMap by apiName).

// ---------- Standard TFT item recipes (apiNames stable across sets) ----------

var STD = {
  // AD ranged carry (Xayah, Jhin, Graves, Corki, Kaisa, etc.)
  AD_CARRY: ['TFT_Item_InfinityEdge', 'TFT_Item_LastWhisper', 'TFT_Item_GiantSlayer'],
  AD_CARRY_ALT: ['TFT_Item_Bloodthirster', 'TFT_Item_Deathblade', 'TFT_Item_RunaansHurricane'],

  // Attack-speed AD reroll carry (Samira, Yi, Pyke)
  AD_AS_CARRY: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_RunaansHurricane', 'TFT_Item_LastWhisper'],
  AD_AS_CARRY_ALT: ['TFT_Item_RedBuff', 'TFT_Item_TitansResolve', 'TFT_Item_InfinityEdge'],

  // AP burst mage (Veigar, Galio, Vex, LeBlanc, Aurelion Sol)
  AP_BURST: ['TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_BlueBuff'],
  AP_BURST_ALT: ['TFT_Item_HextechGunblade', 'TFT_Item_SpearOfShojin', 'TFT_Item_Morellonomicon'],

  // AP DoT / sustain mage (Karma, Nami, Morgana)
  AP_SUSTAIN: ['TFT_Item_SpearOfShojin', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_JeweledGauntlet'],
  AP_SUSTAIN_ALT: ['TFT_Item_HextechGunblade', 'TFT_Item_BlueBuff', 'TFT_Item_Morellonomicon'],

  // Bruiser melee carry (Aatrox, Rhaast, Riven, Akali, Briar, Jax)
  BRUISER: ['TFT_Item_Bloodthirster', 'TFT_Item_TitansResolve', 'TFT_Item_SteraksGage'],
  BRUISER_ALT: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_HextechGunblade', 'TFT_Item_Quicksilver'],

  // Pure tank frontline (Rammus, Mordekaiser, Shen, Maokai, Tahm, Nasus)
  TANK: ['TFT_Item_WarmogsArmor', 'TFT_Item_GargoyleStoneplate', 'TFT_Item_Bloodthirster'],
  TANK_ALT: ['TFT_Item_SteraksGage', 'TFT_Item_Crownguard', 'TFT_Item_AdaptiveHelm'],

  // Tanky-carry hybrid (Nunu, Tahm Kench, Galio in Mecha)
  TANK_CARRY: ['TFT_Item_Bloodthirster', 'TFT_Item_TitansResolve', 'TFT_Item_GargoyleStoneplate'],
  TANK_CARRY_ALT: ['TFT_Item_WarmogsArmor', 'TFT_Item_SteraksGage', 'TFT_Item_HextechGunblade'],
}

// ---------- Hand-curated overrides for headline meta carries ----------
// These reflect Set 17 PBE consensus carry builds. Keys are champion `key`
// values from champions.json (lowercase, no prefix).

var OVERRIDES = {
  xayah:        { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_InfinityEdge', 'TFT_Item_LastWhisper'], reason: 'AS scaling -> Guinsoos. IE for crit. LW for armor shred.' },
  jhin:         { primary: ['TFT_Item_InfinityEdge', 'TFT_Item_GiantSlayer', 'TFT_Item_LastWhisper'],       reason: 'Crit-locked attacks: IE doubles his stacking damage, GS finishes high-HP.' },
  graves:       { primary: ['TFT_Item_InfinityEdge', 'TFT_Item_LastWhisper', 'TFT_Item_GiantSlayer'],       reason: 'Spread crit on cone hits + flat shred.' },
  samira:       { primary: ['TFT_Item_HandOfJustice', 'TFT_Item_TitansResolve', 'TFT_Item_LastWhisper'],    reason: 'Reroll AD carry: HoJ ratio + Titans stacking.' },
  zed:          { primary: ['TFT_Item_HandOfJustice', 'TFT_Item_InfinityEdge', 'TFT_Item_TitansResolve'],   reason: 'Galaxy Hunter assassin: HoJ doubles backline, IE crits, Titans for survival.' },
  galio:        { primary: ['TFT_Item_BlueBuff', 'TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap'],  reason: 'AP nuke + tank: BB for instant cast, Jeweled crit on ability, Rabadon caps.' },
  aurelionsol:  { primary: ['TFT_Item_SpearOfShojin', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_JeweledGauntlet'], reason: 'Channel ult wants Shojin mana. Rabadon scales the AOE.' },
  veigar:       { primary: ['TFT_Item_BlueBuff', 'TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap'],  reason: '1-cost reroll burst: BB cast loop + Jeweled crit cap.' },
  viktor:       { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_NashorsTooth', 'TFT_Item_JeweledGauntlet'], reason: 'Anima Viktor on-hit: Guinsoos + Nashors stack AP per cast.' },
  illaoi:       { primary: ['TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster', 'TFT_Item_WarmogsArmor'],   reason: 'Tentacle bruiser: Titans stacks brutally, BT keeps her alive.' },
  vex:          { primary: ['TFT_Item_BlueBuff', 'TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap'],  reason: 'Doomer one-shot: BB ramp + JG crit doubles.' },
  miss_fortune: { primary: ['TFT_Item_SpearOfShojin', 'TFT_Item_GiantSlayer', 'TFT_Item_LastWhisper'],      reason: 'Conduit: Shojin chains Make It Rain ticks.' },
  missfortune:  { primary: ['TFT_Item_SpearOfShojin', 'TFT_Item_GiantSlayer', 'TFT_Item_LastWhisper'],      reason: 'Conduit: Shojin chains Make It Rain ticks.' },
  kaisa:        { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_RunaansHurricane', 'TFT_Item_LastWhisper'], reason: 'Rogues AS carry: Guinsoo + Runaans for cleave.' },
  corki:        { primary: ['TFT_Item_InfinityEdge', 'TFT_Item_LastWhisper', 'TFT_Item_GiantSlayer'],       reason: 'Meeple AD carry: standard crit-shred core.' },
  yi:           { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_TitansResolve', 'TFT_Item_RunaansHurricane'], reason: 'Reroll AS bruiser: stack Guinsoo + Titans.' },
  briar:        { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster'], reason: 'AS reroll: missing-HP kit loves AS + survival.' },
  riven:        { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_HextechGunblade', 'TFT_Item_TitansResolve'], reason: 'Bruiser caster: AS + omnivamp + stack.' },
  jax:          { primary: ['TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster', 'TFT_Item_SteraksGage'],    reason: 'Front-line bruiser carry: stack + sustain + shield.' },
  rhaast:       { primary: ['TFT_Item_HextechGunblade', 'TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster'], reason: 'Healing-on-hit kit: Gunblade + Titans is BIS.' },
  aatrox:       { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_TitansResolve', 'TFT_Item_HextechGunblade'], reason: 'Stellar Slash heal scales w/ AP: AS + AP-bruiser core.' },
  akali:        { primary: ['TFT_Item_JeweledGauntlet', 'TFT_Item_HextechGunblade', 'TFT_Item_RabadonsDeathcap'], reason: 'Assassin AP: Jeweled crit + Gunblade sustain.' },
  twistedfate:  { primary: ['TFT_Item_BlueBuff', 'TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap'],  reason: '2-cost AP reroll burst: Blue Buff loop is mandatory.' },
  diana:        { primary: ['TFT_Item_HextechGunblade', 'TFT_Item_JeweledGauntlet', 'TFT_Item_RabadonsDeathcap'], reason: 'Anima Diana reroll AP: sustain + crit on ability.' },
  poppy:        { primary: ['TFT_Item_TitansResolve', 'TFT_Item_WarmogsArmor', 'TFT_Item_GargoyleStoneplate'], reason: 'Termeepnal frontline tank-carry.' },
  nasus:        { primary: ['TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster', 'TFT_Item_WarmogsArmor'],   reason: 'Bonk Nasus: stacks autos -> Titans + sustain.' },
  ezreal:       { primary: ['TFT_Item_BlueBuff', 'TFT_Item_JeweledGauntlet', 'TFT_Item_GuinsoosRageblade'], reason: 'Cho-Ez reroll: ult-spam mage variant.' },
  chogath:      { primary: ['TFT_Item_TitansResolve', 'TFT_Item_WarmogsArmor', 'TFT_Item_GargoyleStoneplate'], reason: 'Cho frontline reroll, scales HP.' },
  pyke:         { primary: ['TFT_Item_HandOfJustice', 'TFT_Item_TitansResolve', 'TFT_Item_LastWhisper'],    reason: 'Contract Killer Pyke: crit + survive.' },
  gwen:         { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_NashorsTooth', 'TFT_Item_HextechGunblade'], reason: 'AS hybrid bruiser: Guinsoo + Nashors core.' },
  leblanc:      { primary: ['TFT_Item_JeweledGauntlet', 'TFT_Item_HextechGunblade', 'TFT_Item_RabadonsDeathcap'], reason: 'Assassin AP burst: Jeweled doubles W damage.' },
  teemo:        { primary: ['TFT_Item_GuinsoosRageblade', 'TFT_Item_NashorsTooth', 'TFT_Item_RabadonsDeathcap'], reason: 'AS poison-on-hit reroll: Guinsoo + Nashors.' },
  nami:         { primary: ['TFT_Item_SpearOfShojin', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_JeweledGauntlet'], reason: 'Karma/Nami flex: Shojin chain casts.' },
  karma:        { primary: ['TFT_Item_SpearOfShojin', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_JeweledGauntlet'], reason: 'Mantra spam: Shojin loop is mandatory.' },
  morgana:      { primary: ['TFT_Item_HextechGunblade', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_JeweledGauntlet'], reason: 'AP sustain mage: Gunblade + AP.' },
  tahmkench:    { primary: ['TFT_Item_TitansResolve', 'TFT_Item_Bloodthirster', 'TFT_Item_GargoyleStoneplate'], reason: 'Oracle tank-carry: stack + lifesteal + armor.' },
  nunu:         { primary: ['TFT_Item_TitansResolve', 'TFT_Item_WarmogsArmor', 'TFT_Item_Bloodthirster'],   reason: 'Stargazer tank-carry: HP + sustain core.' },
  shen:         { primary: ['TFT_Item_GargoyleStoneplate', 'TFT_Item_WarmogsArmor', 'TFT_Item_Bloodthirster'], reason: 'Bulwark frontline: armor stacking + sustain.' },
}

// ---------- Archetype detection ----------

var TANK_TRAITS = new Set(['TFT17_HPTank', 'TFT17_ResistTank', 'TFT17_ShieldTank', 'TFT17_ShenUniqueTrait'])
var BACKLINE_TRAITS = new Set(['TFT17_RangedTrait', 'TFT17_APTrait', 'TFT17_PsyOps', 'TFT17_JhinUniqueTrait', 'TFT17_MissFortuneUniqueTrait'])
var AS_TRAITS = new Set(['TFT17_ASTrait']) // Challenger
var ROGUE_TRAITS = new Set(['TFT17_AssassinTrait', 'TFT17_ZedUniqueTrait', 'TFT17_FioraUniqueTrait'])

function abilityScalingType(c) {
  // Inspect ability.variables[] for the dominant scaling magnitude.
  // Returns 'ad' | 'ap' | 'mixed' | 'unknown'.
  var vars = c && c.ability && c.ability.variables
  if (!Array.isArray(vars)) return 'unknown'
  var maxAd = 0
  var maxAp = 0
  vars.forEach(function (v) {
    var name = String(v.name || '').toLowerCase()
    var values = Array.isArray(v.value) ? v.value : []
    if (values.length === 0) return
    var peak = 0
    values.forEach(function (x) { if (typeof x === 'number' && x > peak) peak = x })
    if (name.indexOf('ad') !== -1 && name.indexOf('damage') !== -1) {
      if (peak > maxAd) maxAd = peak
    } else if (name.indexOf('ap') !== -1 && name.indexOf('damage') !== -1) {
      if (peak > maxAp) maxAp = peak
    }
  })
  if (maxAd === 0 && maxAp === 0) return 'unknown'
  if (maxAd > maxAp * 1.5) return 'ad'
  if (maxAp > maxAd * 1.5) return 'ap'
  return 'mixed'
}

function detectArchetype(c) {
  var range = (c.stats && c.stats.range) || 1
  var hp = (c.stats && c.stats.hp) || 700
  var traits = new Set(c.traits || [])

  var hasTank = false
  TANK_TRAITS.forEach(function (t) { if (traits.has(t)) hasTank = true })
  var hasBackline = false
  BACKLINE_TRAITS.forEach(function (t) { if (traits.has(t)) hasBackline = true })
  var hasAS = false
  AS_TRAITS.forEach(function (t) { if (traits.has(t)) hasAS = true })
  var hasRogue = false
  ROGUE_TRAITS.forEach(function (t) { if (traits.has(t)) hasRogue = true })

  var scaling = abilityScalingType(c)

  // Pure tank: has tank trait, range 1, no AD/AP scaling
  if (hasTank && range <= 1 && scaling !== 'ap' && scaling !== 'ad') return 'TANK'
  // Tanky carry: has tank trait + scaling
  if (hasTank && (scaling === 'ad' || scaling === 'ap' || scaling === 'mixed')) return 'TANK_CARRY'
  // Ranged AD carry
  if (range >= 3 && scaling !== 'ap') return 'AD_CARRY'
  // AS-trait melee/short range carry
  if (hasAS && range <= 2) return scaling === 'ap' ? 'BRUISER' : 'AD_AS_CARRY'
  // Backline mage
  if (range >= 2 && (scaling === 'ap' || hasBackline)) return scaling === 'ap' ? 'AP_BURST' : 'AP_SUSTAIN'
  // Rogue assassin (AP scaling -> burst, AD -> bruiser)
  if (hasRogue) return scaling === 'ap' ? 'AP_BURST' : 'BRUISER'
  // Bruiser melee with scaling
  if (range <= 1 && (scaling === 'ad' || scaling === 'ap' || scaling === 'mixed')) return 'BRUISER'
  // Heavy tank fallback
  if (range <= 1 && hp >= 800) return 'TANK'
  // Default: bruiser
  return 'BRUISER'
}

// ---------- Public API ----------

export function recommendItems(champion) {
  if (!champion) return null
  var key = champion.key
  // Hand override first
  if (OVERRIDES[key]) {
    var ov = OVERRIDES[key]
    return {
      primary: ov.primary.slice(),
      alts: (STD[detectArchetype(champion) + '_ALT'] || []).slice(),
      reason: ov.reason,
      archetype: detectArchetype(champion),
      curated: true,
    }
  }
  var arch = detectArchetype(champion)
  return {
    primary: (STD[arch] || STD.BRUISER).slice(),
    alts: (STD[arch + '_ALT'] || []).slice(),
    reason: archetypeReason(arch),
    archetype: arch,
    curated: false,
  }
}

function archetypeReason(arch) {
  if (arch === 'AD_CARRY') return 'Ranged AD: crit core + armor shred for the back-row carry slot.'
  if (arch === 'AD_AS_CARRY') return 'Attack-speed carry: Guinsoo stacks + cleave + shred.'
  if (arch === 'AP_BURST') return 'AP nuke: mana battery + crit-on-ability + AP cap.'
  if (arch === 'AP_SUSTAIN') return 'Channel mage: Shojin loop + AP scaling.'
  if (arch === 'BRUISER') return 'Frontline bruiser: stack + sustain + shield core.'
  if (arch === 'TANK_CARRY') return 'Tanky carry: stack stat + lifesteal + armor.'
  if (arch === 'TANK') return 'Pure tank: HP scaling + armor + AS-aura.'
  return 'Generic frontline build.'
}

export function lookupItems(itemMap, apiNames) {
  return (apiNames || []).map(function (n) { return itemMap[n] }).filter(Boolean)
}

// Build an apiName -> item lookup once, callers cache it.
export function buildItemMap(items) {
  var m = {}
  ;(items || []).forEach(function (it) { if (it && it.apiName) m[it.apiName] = it })
  return m
}
