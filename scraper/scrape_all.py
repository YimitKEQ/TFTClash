"""
Donut17 Scraper -- fetches Set 17 data from Community Dragon + enriches with tactics.tools URLs
Run from TFT Clash project root: python scraper/scrape_all.py
Outputs JSON to src/donut17/data/
"""

import json
import os
import re
import time

import requests

OUTPUT_DIR = "src/donut17/data"
CDRAGON_BASE = "https://raw.communitydragon.org/pbe/"
RAW_URL = CDRAGON_BASE + "cdragon/tft/en_us.json"
SET_NUM = 17
SET_PREFIXES = ("TFT17_", "TFTSet17_")


def fetch_cdragon():
    print("Fetching cdragon master JSON (this is ~20MB, please wait)...")
    r = requests.get(RAW_URL, timeout=60)
    r.raise_for_status()
    data = r.json()
    print("  Top-level keys:", list(data.keys())[:20])
    return data


def get_set_data(data):
    """Find Set 17 data inside the cdragon JSON. Structure varies by patch."""
    # Try sets dict with string key "17"
    if "sets" in data and str(SET_NUM) in data["sets"]:
        print("  Found data under data['sets']['17']")
        return data["sets"][str(SET_NUM)]
    # Try setData list (0-indexed, so set 17 = index 16)
    if "setData" in data:
        for sd in data["setData"]:
            if sd.get("number") == SET_NUM or sd.get("mutator", "").endswith(str(SET_NUM)):
                print("  Found data under setData")
                return sd
    return None


def cdragon_to_tt_key(api_name):
    """TFT17_Aatrox -> aatrox"""
    name = api_name.split("_", 1)[1] if "_" in api_name else api_name
    return name.lower()


def cdragon_to_tt_pascal(api_name):
    """TFT17_Aatrox -> Aatrox"""
    return api_name.split("_", 1)[1] if "_" in api_name else api_name


def icon_url(icon_path):
    """Convert cdragon relative icon path to full URL."""
    if not icon_path:
        return ""
    lower = icon_path.lower()
    if lower.startswith("/lol-game-data/assets/"):
        clean = lower.replace("/lol-game-data/assets/", "")
        return CDRAGON_BASE + "plugins/rcp-be-lol-game-data/global/default/" + clean
    if lower.startswith("assets/"):
        return CDRAGON_BASE + "game/" + lower
    return icon_path


def parse_champions(data, set_data):
    """Extract Set 17 champions. Try set_data first, fall back to flat list."""
    raw_champs = []

    if set_data and "champions" in set_data:
        raw_champs = set_data["champions"]
        print("  Using set_data champions:", len(raw_champs))
    elif "champions" in data:
        raw_champs = [c for c in data["champions"]
                      if any(c.get("apiName", "").startswith(p) for p in SET_PREFIXES)]
        print("  Using flat champions filtered by prefix:", len(raw_champs))

    champs = []
    for champ in raw_champs:
        api_name = champ.get("apiName", "")
        if not api_name:
            continue
        # Skip non-Set17 entries that slipped through
        if set_data is None:
            if not any(api_name.startswith(p) for p in SET_PREFIXES):
                continue

        traits = champ.get("traits", [])
        cost = champ.get("cost", 0)
        stats = champ.get("stats", {})
        ability = champ.get("ability", {})
        key = cdragon_to_tt_key(api_name)
        pascal = cdragon_to_tt_pascal(api_name)

        # Build a chain of image URLs. cdragon is authoritative but emits .tex
        # which browsers can't render -- rewrite to .png so cdragon auto-converts.
        raw_square = champ.get("squarePath", champ.get("icon", ""))
        cdragon_square = icon_url(raw_square)
        if cdragon_square.endswith(".tex"):
            cdragon_square = cdragon_square[:-4] + ".png"
        # cdragon HUD square -- the in-game portrait icon, tightly cropped.
        hud_square = (CDRAGON_BASE + "plugins/rcp-be-lol-game-data/global/default/"
                      "assets/characters/tft17_{}/hud/tft17_{}_square.tft_set17.png").format(key, key)

        champs.append({
            "apiName": api_name,
            "key": key,
            "name": champ.get("name", pascal),
            "cost": cost,
            "traits": traits,
            "stats": {
                "hp": stats.get("hp", 0),
                "mana": stats.get("mana", 0),
                "initialMana": stats.get("initialMana", 0),
                "damage": stats.get("damage", 0),
                "armor": stats.get("armor", 0),
                "magicResist": stats.get("magicResist", 0),
                "attackSpeed": stats.get("attackSpeed", 0),
                "range": stats.get("range", 0),
            },
            "ability": {
                "name": ability.get("name", ""),
                "desc": ability.get("desc", ""),
                "variables": ability.get("variables", []),
            },
            "assets": {
                "hud": hud_square,
                "square": cdragon_square,
                "face": "https://ap.tft.tools/img/new17/face/tft17_{}.jpg?w=36".format(key),
                "face_lg": "https://ap.tft.tools/img/new17/face/tft17_{}.jpg?w=64".format(key),
                "wide": "https://ap.tft.tools/img/new17/face_full_ultrawide/TFT17_{}.jpg?w=290".format(pascal),
                "ability": "https://ap.tft.tools/img/new17/ability/TFT17_{}.png?w=22".format(pascal),
            },
            "role": "",
            "bis": [],
        })

    return sorted(champs, key=lambda x: (x["cost"], x["name"]))


def parse_traits(data, set_data):
    """Extract Set 17 traits."""
    raw_traits = []

    if set_data and "traits" in set_data:
        raw_traits = set_data["traits"]
        print("  Using set_data traits:", len(raw_traits))
    elif "traits" in data:
        raw_traits = [t for t in data["traits"]
                      if any(t.get("apiName", "").startswith(p) for p in SET_PREFIXES)]
        print("  Using flat traits filtered by prefix:", len(raw_traits))

    traits = []
    for trait in raw_traits:
        api_name = trait.get("apiName", "")
        if not api_name:
            continue

        effects = []
        for eff in trait.get("effects", []):
            effects.append({
                "minUnits": eff.get("minUnits", 0),
                "maxUnits": eff.get("maxUnits", 0),
                "variables": eff.get("variables", {}),
            })

        trait_key = api_name.split("_", 1)[1].lower() if "_" in api_name else api_name.lower()
        trait_type = trait.get("type", "")

        traits.append({
            "apiName": api_name,
            "key": trait_key,
            "name": trait.get("name", trait_key),
            "desc": trait.get("desc", ""),
            "type": trait_type,
            "icon": "https://ap.tft.tools/static/trait-icons/new17_tft17_{}_w.svg".format(trait_key),
            "effects": effects,
        })

    return traits


def parse_items(data):
    """Extract relevant items (components + combineds)."""
    raw = data.get("items", [])
    items = []
    for item in raw:
        api_name = item.get("apiName", "")
        name = item.get("name", "")
        # Skip augments and junk entries
        if "Augment" in api_name or not name:
            continue
        # Include standard TFT items (no set prefix needed for items)
        if not (api_name.startswith("TFT_Item") or api_name.startswith("TFT17") or
                api_name.startswith("TFTItem")):
            continue
        items.append({
            "apiName": api_name,
            "name": name,
            "desc": item.get("desc", ""),
            "effects": item.get("effects", {}),
            "from": item.get("from", []),
            "unique": item.get("unique", False),
            "icon": icon_url(item.get("icon", "")),
        })
    return items


def parse_augments(data):
    """Extract Set 17 augments."""
    raw = data.get("augments", data.get("items", []))
    augments = []
    for aug in raw:
        api_name = aug.get("apiName", "")
        if not api_name:
            continue
        is_augment = ("Augment" in api_name or "TFT17" in api_name or "TFT_Augment" in api_name)
        if not is_augment:
            continue
        augments.append({
            "apiName": api_name,
            "name": aug.get("name", ""),
            "desc": aug.get("desc", ""),
            "tier": aug.get("tier", 0),
            "icon": icon_url(aug.get("icon", "")),
        })
    return augments


def build_gods():
    """God data - manually maintained since it is not in cdragon."""
    return [
        {
            "name": "Ahri", "key": "ahri", "title": "God of Opulence",
            "color": "#f472b6",
            "blessing": "Gain 2 gold, 2 XP, and 2 rerolls each round",
            "offerings": {
                "stage2": ["6 gold", "8 XP", "5 rerolls", "6 gold (maybe +1)"],
                "stage3": ["8 gold", "7 rerolls", "10 XP", "8 gold (maybe +2)"],
                "stage4": ["12 gold", "8 rerolls", "12 gold (maybe +3)"],
            },
            "tip": "Best for fast 8/9 strategies. Pair with Timebreaker econ.",
            "bestComps": ["Fast 9", "High Cost Flex"],
            "image": "https://ap.tft.tools/img/new17/gods/ahri.png?w=400",
        },
        {
            "name": "Aurelion Sol", "key": "aurelionsol", "title": "God of Wonders",
            "color": "#a78bfa",
            "blessing": "Choose one of three trials to prove yourself",
            "offerings": {
                "stage2": ["Reach 50g -> comp anvil + 4g", "Field 6 traits -> emblem + reforger"],
                "stage3": ["Star up a unit -> 10g", "Field 6 traits -> emblem + reforger"],
                "stage4": ["Reach lvl 9 -> 20g"],
            },
            "tip": "Needs strong opener. Great with emblem-heavy comps.",
            "bestComps": ["Emblem Vertical", "6-Trait Flex"],
            "image": "https://ap.tft.tools/img/new17/gods/aurelionsol.png?w=400",
        },
        {
            "name": "Ekko", "key": "ekko", "title": "God of Time",
            "color": "#34d399",
            "blessing": "Gain the Anomaly item with unique role-based bonuses",
            "offerings": {
                "stage2": ["Scuttle Puddle (orb + 3g)", "Blessing at 30HP", "Spat in 4 rounds", "Artifact in 8 rounds", "4-cost in 3 rounds"],
                "stage3": ["Scuttle Puddle (orb + 4g)", "Implant (20% AS)", "2x 5-cost in 4 rounds", "Comp anvil in 3 rounds"],
                "stage4": ["Artifact in 5 rounds", "Completed anvil in 4 rounds", "2g every turn", "Full 5-cost shop in 3 rounds"],
            },
            "tip": "Flexible scaling. Anomaly item is always useful.",
            "bestComps": ["Any - universally good"],
            "image": "https://ap.tft.tools/img/new17/gods/ekko.png?w=400",
        },
        {
            "name": "Evelynn", "key": "evelynn", "title": "God of Temptation",
            "color": "#f87171",
            "blessing": "Team gains 10% Durability. Lose 1 extra HP on loss.",
            "offerings": {
                "stage2": ["8g (lose 1HP/round)", "2-star 2-cost (-1HP)", "2x dupe (no shop 2 rounds)"],
                "stage3": ["11g (lose 1HP/round)", "Random emblem (-3HP)", "15g (no shop 2 rounds)", "2-star 3-cost (-2HP)"],
                "stage4": ["14g (lose 1HP/round)", "2-star 4-cost (-3HP)", "Completed item (-5HP)", "18g (no shop 2 rounds)"],
            },
            "tip": "High risk. Best with reroll comps or lose streak openers.",
            "bestComps": ["Reroll", "Anima Lose Streak"],
            "image": "https://ap.tft.tools/img/new17/gods/evelynn.png?w=400",
        },
        {
            "name": "Kayle", "key": "kayle", "title": "God of Order",
            "color": "#fbbf24",
            "blessing": "Upgrade a random completed item to Radiant",
            "offerings": {
                "stage2": ["Sparring Glove", "Recurve Bow", "Tear", "Random component"],
                "stage3": ["BF Sword", "Chain Vest", "Rod", "Negatron", "Random component"],
                "stage4": ["Full component selection available"],
            },
            "tip": "Most consistent god. Guaranteed Radiant item is huge.",
            "bestComps": ["Any item-reliant carry"],
            "image": "https://ap.tft.tools/img/new17/gods/kayle.png?w=400",
        },
        {
            "name": "Soraka", "key": "soraka", "title": "God of Stars",
            "color": "#a3e635",
            "blessing": "+2 HP per missing tactician HP, +1 current and max HP per round",
            "offerings": {
                "stage2": ["8 HP (maybe 3g)", "12 HP", "Giant's Belt"],
                "stage3": ["8 HP (maybe 5g)", "12 HP", "Giant's Belt", "Implant (350 HP)"],
                "stage4": ["8 HP (maybe 5g)", "12 HP", "Giant's Belt", "Implant (350 HP)"],
            },
            "tip": "Stabilizer god. Great for lose streak recovery.",
            "bestComps": ["Slow Roll", "Lose Streak to Win"],
            "image": "https://ap.tft.tools/img/new17/gods/soraka.png?w=400",
        },
        {
            "name": "Thresh", "key": "thresh", "title": "God of Pacts",
            "color": "#38bdf8",
            "blessing": "After each player combat, roll a die. Gain rewards based on result.",
            "offerings": {
                "stage2": ["Random + 2g", "Random loot (EV ~7g)"],
                "stage3": ["Random + 3g", "Random loot (EV ~9g)"],
                "stage4": ["Random + 5g", "Random loot (EV ~10g)"],
            },
            "tip": "Pure gambling. High variance, can highroll hard.",
            "bestComps": ["Any - just pray"],
            "image": "https://ap.tft.tools/img/new17/gods/thresh.png?w=400",
        },
        {
            "name": "Varus", "key": "varus", "title": "God of Love",
            "color": "#e879f9",
            "blessing": "+10 HP per total star level in army. +4% five-cost odds.",
            "offerings": {
                "stage2": ["2 & 3-cost pair", "Owned 3-cost", "2 tiny dupes", "3-cost shop"],
                "stage3": ["3 & 4-cost pair", "Lesser dupe", "Owned 3-cost", "4-cost shop"],
                "stage4": ["4 & 5-cost pair", "Lesser dupe + 3g", "1 lesser + 5 tiny dupes", "Owned 4-cost"],
            },
            "tip": "Best for reroll comps and 5-cost hunting at level 8-9.",
            "bestComps": ["Reroll", "5-Cost Fast 9"],
            "image": "https://ap.tft.tools/img/new17/gods/varus.png?w=400",
        },
        {
            "name": "Yasuo", "key": "yasuo", "title": "God of the Abyss",
            "color": "#94a3b8",
            "blessing": "+50% hex power. If only 2 hexes, gain 12 gold instead.",
            "offerings": {
                "stage2": ["Fire Hex (18% dmg, burn/wound)", "Wood Hex (10% + 30HP)", "Wind Hex (30% AS)", "Ice Hex (15% heal)", "Electric Hex (2s stun)", "Socialite Hex (2 mana regen)"],
                "stage3": ["Same hex options"],
                "stage4": ["Same hex options"],
            },
            "tip": "Positioning-dependent. Wind/Fire hexes strongest. Synergizes with Stargazer.",
            "bestComps": ["Stargazer", "Hex-focused boards"],
            "image": "https://ap.tft.tools/img/new17/gods/yasuo.png?w=400",
        },
    ]


TFTFLOW_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "sources", "tftflow_set17.json"
)

# tftflow tier letters (OP highest, D lowest). Map to scoring tier bonus letters
# (the existing front-end scoring uses S/A/B/C/X).
_TFTFLOW_TIER_ORDER = {"OP": 0, "S+": 1, "S": 2, "A": 3, "B": 4, "C": 5, "D": 6}
_TFTFLOW_TIER_TO_BONUS = {
    "OP": "S",
    "S+": "S",
    "S": "S",
    "A": "A",
    "B": "B",
    "C": "C",
    "D": "X",
}


def _best_tftflow_tier(tiers):
    """Return the highest (strongest) tier from a list of tftflow placements."""
    if not tiers:
        return None
    return min(tiers, key=lambda t: _TFTFLOW_TIER_ORDER.get(t, 99))


def build_comp_lines(champions):
    """Load tftflow-scraped Set 17 comps verbatim.

    Source of truth: scraper/sources/tftflow_set17.json (generated by
    scraper/sources/fetch_tftflow.py which scrapes tftflow.com/tier-list and
    each /composition/set17/<slug> detail page). No curation, no synthesized
    strategy -- we mirror tftflow's tier placements, boards, carries, and
    augments exactly.
    """
    if not os.path.exists(TFTFLOW_FILE):
        print(
            "  WARNING: {} missing. Run 'py scraper/sources/fetch_tftflow.py' first".format(
                TFTFLOW_FILE
            )
        )
        return []
    with open(TFTFLOW_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)

    api_to_key = {}
    key_to_champ = {}
    for c in champions:
        ap = (c.get("apiName") or "").lower()
        if ap:
            api_to_key[ap] = c["key"]
        key_to_champ[c["key"]] = c

    def is_rollable(key):
        # Cosmetic summons (Bia & Bayin at cost 11, Mini Black Hole etc.) and
        # any "placeholder" unit with no traits aren't actually in the shop —
        # they shouldn't appear on a comp board that the opener advisor ranks.
        champ = key_to_champ.get(key)
        if not champ:
            return False
        cost = champ.get("cost") or 0
        if cost and cost > 6:
            return False
        if not (champ.get("traits") or []):
            return False
        return True

    def tokens_from(s):
        # normalize a slug/title into tokens suitable for name matching
        return set(re.findall(r"[a-z0-9]+", (s or "").lower()))

    out = []
    skipped_units = 0
    for comp in raw:
        carries_keys = []
        other_keys = []
        for unit in comp.get("board", []):
            api = (unit.get("apiName") or "").lower()
            key = api_to_key.get(api)
            if not key:
                skipped_units += 1
                continue
            if not is_rollable(key):
                continue
            if unit.get("carry"):
                if key not in carries_keys:
                    carries_keys.append(key)
            else:
                if key not in other_keys:
                    other_keys.append(key)
        if not carries_keys and not other_keys:
            continue

        # Promote any board unit whose key or display name appears in the comp
        # slug/title into the carries list. tftflow's champion-name--carry class
        # is inconsistent: sometimes it marks the tank item-holder (e.g. Nunu in
        # Stargazer Xayah), sometimes it's missing entirely (e.g. Karma Nami).
        # The slug/title always names the damage carry, so use it as ground truth.
        hay = tokens_from(comp.get("slug", "")) | tokens_from(comp.get("name", ""))
        for k in list(other_keys):
            champ_name = (key_to_champ.get(k, {}).get("name") or "").lower()
            champ_tokens = tokens_from(champ_name) | {k}
            if hay & champ_tokens:
                other_keys.remove(k)
                if k not in carries_keys:
                    carries_keys.append(k)

        primary_carry = carries_keys[0] if carries_keys else (other_keys[0] if other_keys else None)
        best_tier = _best_tftflow_tier(comp.get("tiers", []))
        bonus_tier = _TFTFLOW_TIER_TO_BONUS.get(best_tier, "X")

        out.append(
            {
                "id": comp.get("slug", ""),
                "name": comp.get("name", ""),
                # Scoring tier (bonus letter). Lower = better in the front-end.
                "tier": bonus_tier,
                # tftflow's raw data, preserved verbatim for display:
                "tftflowTiers": comp.get("tiers", []),
                "tftflowBestTier": best_tier,
                "econ": comp.get("econ"),
                "patch": comp.get("patch"),
                "url": comp.get("url", ""),
                "carry": primary_carry,
                "carries": carries_keys,
                # board = all unit keys; scoring resolves carry bonus via carries[]
                "board": carries_keys + other_keys,
                # tftflow does not split early/flex; left empty on purpose
                "early": [],
                "flex": [],
                "augments": comp.get("augments", []),
            }
        )

    print(
        "  Loaded {} tftflow comps (patch {}), {} unmapped units skipped".format(
            len(out),
            raw[0].get("patch", "?") if raw else "?",
            skipped_units,
        )
    )
    return out


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("  Wrote {} ({} entries)".format(path, len(data) if isinstance(data, list) else "dict"))


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Fetch cdragon data
    data = fetch_cdragon()

    # 2. Find set-specific sub-object
    set_data = get_set_data(data)
    if set_data:
        print("  Set data keys:", list(set_data.keys())[:15])
    else:
        print("  WARNING: No dedicated set_data found. Using flat lists filtered by prefix.")

    # 3. Parse
    champions = parse_champions(data, set_data)
    traits = parse_traits(data, set_data)
    items = parse_items(data)
    augments = parse_augments(data)

    # Remap champion traits from display names ("Doomer") to apiNames ("TFT17_VexUniqueTrait")
    name_to_api = {}
    for t in traits:
        api = t.get("apiName")
        nm = t.get("name")
        if api and nm:
            name_to_api[nm] = api
            name_to_api[nm.lower()] = api
    for champ in champions:
        remapped = []
        for raw in champ.get("traits", []):
            api = name_to_api.get(raw) or name_to_api.get(str(raw).lower()) or raw
            remapped.append(api)
        champ["traits"] = remapped

    print("\nParsed: {} champions, {} traits, {} items, {} augments".format(
        len(champions), len(traits), len(items), len(augments)))

    # Print a few champions to verify
    if champions:
        print("  Sample champions:", [c["name"] for c in champions[:8]])
    if traits:
        print("  Sample traits:", [t["name"] for t in traits[:8]])

    # 4. Build static data
    gods = build_gods()
    comp_lines = build_comp_lines(champions)

    # Prune comp board/early/flex refs that don't exist in the Set 17 roster.
    known_keys = {c["key"] for c in champions}
    pruned_total = 0
    pruned_comps = 0
    for comp in comp_lines:
        touched = False
        for field in ("board", "early", "flex"):
            before = len(comp.get(field, []))
            comp[field] = [k for k in comp.get(field, []) if k in known_keys]
            after = len(comp[field])
            if after < before:
                pruned_total += before - after
                touched = True
        if touched:
            pruned_comps += 1
        if comp.get("carry") and comp["carry"] not in known_keys:
            comp["carry"] = (comp.get("board") or comp.get("early") or [comp["carry"]])[0]
    if pruned_total:
        print("  Pruned {} stale unit refs across {} comps".format(pruned_total, pruned_comps))

    # 5. Build synergy grid
    origins = [t for t in traits if t.get("type") == "origin"]
    classes = [t for t in traits if t.get("type") == "class"]
    print("  Origins: {}, Classes: {}".format(len(origins), len(classes)))

    synergy_grid = {}
    for champ in champions:
        for t1 in champ["traits"]:
            for t2 in champ["traits"]:
                if t1 == t2:
                    continue
                key = "{}|{}".format(t1, t2)
                if key not in synergy_grid:
                    synergy_grid[key] = []
                if champ["key"] not in synergy_grid[key]:
                    synergy_grid[key].append(champ["key"])

    # 6. Write all JSON files
    write_json("{}/champions.json".format(OUTPUT_DIR), champions)
    write_json("{}/traits.json".format(OUTPUT_DIR), traits)
    write_json("{}/items.json".format(OUTPUT_DIR), items)
    write_json("{}/augments.json".format(OUTPUT_DIR), augments)
    write_json("{}/gods.json".format(OUTPUT_DIR), gods)
    write_json("{}/comp_lines.json".format(OUTPUT_DIR), comp_lines)
    write_json("{}/synergy_grid.json".format(OUTPUT_DIR), synergy_grid)

    print("\nDone! All data written to {}/".format(OUTPUT_DIR))
    print("Run 'npm run dev' and navigate to /donut17")


if __name__ == "__main__":
    main()
