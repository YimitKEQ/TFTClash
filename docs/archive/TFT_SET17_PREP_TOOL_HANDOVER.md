# TFT SET 17: SPACE GODS — PREP TOOL (DONUT17)
## Claude Code Handover Document

---

## 1. PROJECT OVERVIEW

Add a **hidden page** to the existing TFT Clash website at the route `/donut17`. This page is a TFT Set 17 interactive prep tool for the homies — it is NOT linked from any navigation, sidebar, or footer on TFT Clash. The only way to reach it is by typing the URL directly (e.g. `tftclash.com/donut17`).

The page scrapes all champion, trait, item, augment, and god data from Community Dragon + tactics.tools, stores it as structured JSON inside the existing project, and renders as a self-contained React page within the TFT Clash app.

**The goal**: Replace a messy Google Sheet ("Donut Recipe") with a polished, interactive web tool for Set 17 tournament prep. This is for personal/crew use, not a public feature.

**Creator**: Lodie (EUW, competitive TFT player)

**CRITICAL**: This page must be completely isolated from the rest of TFT Clash. It does NOT use `useApp()`, does NOT touch Supabase, does NOT interact with any existing TFT Clash state/data. It's a standalone page that just happens to live under the same domain.

---

## 2. TECH STACK

This lives inside the existing TFT Clash project. No new dependencies needed beyond the scraper.

| Layer | Tool | Notes |
|-------|------|-------|
| Scraper | Python 3.11+ (`requests`, `beautifulsoup4`) | Run locally, outputs JSON into project |
| Data | JSON files in `src/donut17/data/` | Static imports, no Supabase |
| Frontend | React, Vite, Tailwind (existing TFT Clash stack) | Self-contained page component |
| Fonts | Chakra Petch, Orbitron, JetBrains Mono | Loaded via Google Fonts in the Donut17 page only |
| Deployment | Deploys with TFT Clash (Vercel) | Just another route |

---

## 3. DATA SOURCES & SCRAPING

### 3A. Community Dragon (PRIMARY — canonical game data)

Community Dragon (cdragon) maintains a parsed mirror of Riot's game data. For PBE/new set data, use the `pbe` branch. Once the set goes live, switch to `latest`.

**Master TFT data file:**
```
https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json
```

This single JSON contains EVERYTHING: champions (called "champions"), traits (called "traits"), items, augments, sets, and set data. The structure nests by set number.

**Parsing the master JSON:**

```python
import requests, json, os

RAW = "https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json"
SET_PREFIX = "TFTSet17"  # or "TFT17" — check the actual key in the JSON

def fetch_cdragon():
    print("Fetching cdragon master JSON...")
    r = requests.get(RAW)
    r.raise_for_status()
    data = r.json()
    return data

def parse_champions(data):
    """Extract Set 17 champions from cdragon data."""
    champs = []
    # cdragon nests set data under "setData" or "sets"
    # The exact key varies — inspect the JSON structure
    # Look for entries where apiName starts with SET_PREFIX
    
    for champ in data.get("champions", []):
        # Filter to Set 17 only
        api_name = champ.get("apiName", "")
        if not api_name.startswith("TFT17_") and not api_name.startswith("TFTSet17_"):
            continue
        
        traits = champ.get("traits", [])
        cost = champ.get("cost", 0)
        stats = champ.get("stats", {})
        ability = champ.get("ability", {})
        
        champs.append({
            "apiName": api_name,
            "name": champ.get("name", ""),
            "cost": cost,
            "traits": traits,  # List of trait apiNames
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
        })
    
    return sorted(champs, key=lambda x: (x["cost"], x["name"]))

def parse_traits(data):
    """Extract Set 17 traits."""
    traits = []
    for trait in data.get("traits", []):
        api_name = trait.get("apiName", "")
        if not api_name.startswith("TFT17_") and not api_name.startswith("TFTSet17_"):
            continue
        
        effects = []
        for eff in trait.get("effects", []):
            effects.append({
                "minUnits": eff.get("minUnits", 0),
                "maxUnits": eff.get("maxUnits", 0),
                "variables": eff.get("variables", {}),
            })
        
        traits.append({
            "apiName": api_name,
            "name": trait.get("name", ""),
            "desc": trait.get("desc", ""),
            "type": trait.get("type", ""),  # "origin" or "class"
            "effects": effects,
        })
    
    return traits

def parse_items(data):
    """Extract Set 17 items."""
    items = []
    for item in data.get("items", []):
        # Items don't always have set prefixes — filter by context
        # Include base items, combined items, and set-specific items
        items.append({
            "apiName": item.get("apiName", ""),
            "name": item.get("name", ""),
            "desc": item.get("desc", ""),
            "effects": item.get("effects", {}),
            "from": item.get("from", []),  # Component item IDs
            "icon": item.get("icon", ""),
            "unique": item.get("unique", False),
        })
    return items

def parse_augments(data):
    """Extract augments."""
    augments = []
    for aug in data.get("augments", data.get("items", [])):
        api_name = aug.get("apiName", "")
        # Augments often have "Augment" in their apiName
        if "Augment" not in api_name and "TFT17" not in api_name:
            continue
        augments.append({
            "apiName": api_name,
            "name": aug.get("name", ""),
            "desc": aug.get("desc", ""),
            "tier": aug.get("tier", 0),  # 1=silver, 2=gold, 3=prismatic
        })
    return augments
```

**IMPORTANT**: The cdragon JSON structure changes between sets. The scraper MUST inspect the actual JSON and adapt. Print the top-level keys first, then drill into the set-specific data. Common patterns:

```python
# Inspect structure
data = fetch_cdragon()
print("Top-level keys:", list(data.keys()))

# Set data is often nested under:
# data["sets"]["17"] or data["setData"][16] (0-indexed) 
# or data["champions"] is a flat list with apiName prefixes
```

### 3B. Community Dragon — Image Assets

Champion square icons and ability icons are hosted on cdragon's CDN:

```
# Champion square icons (used in-game)
https://raw.communitydragon.org/pbe/game/assets/ux/tft/championsplashes/tft17_aatrox_square.tft_set17.png

# Champion splash/portraits
https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/characters/tft17_aatrox/skins/base/images/tft17_aatrox_splash_centered_0.jpg

# Trait icons
https://raw.communitydragon.org/pbe/game/assets/ux/traiticons/trait_icon_17_bastion.png

# Item icons
https://raw.communitydragon.org/pbe/game/assets/maps/particles/tft/item_icons/standard/...
```

**NOTE**: Exact paths shift between sets. The cdragon JSON includes `icon` fields with relative paths — use those to construct full URLs:

```python
CDRAGON_BASE = "https://raw.communitydragon.org/pbe/"

def icon_url(icon_path):
    """Convert cdragon relative icon path to full URL."""
    # cdragon paths often start with "/lol-game-data/assets/" 
    # which maps to plugins/rcp-be-lol-game-data/global/default/
    if icon_path.startswith("/lol-game-data/assets/"):
        clean = icon_path.replace("/lol-game-data/assets/", "")
        return f"{CDRAGON_BASE}plugins/rcp-be-lol-game-data/global/default/{clean.lower()}"
    return icon_path
```

### 3C. Tactics.tools (SECONDARY — polished assets)

tactics.tools has very clean, pre-cropped assets ideal for web display:

```python
TACTICS_TOOLS = {
    # Champion face portraits (small square)
    "face": "https://ap.tft.tools/img/new17/face/tft17_{key}.jpg?w=36",
    
    # Champion wide portrait (banner style)
    "face_wide": "https://ap.tft.tools/img/new17/face_full_ultrawide/TFT17_{Key}.jpg?w=290",
    
    # Trait icons (white SVG, ideal for dark backgrounds)
    "trait_icon": "https://ap.tft.tools/static/trait-icons/new17_tft17_{key}_w.svg",
    
    # God images
    "god": "https://ap.tft.tools/img/new17/gods/{key}.png?w=400",
    
    # Set key art
    "keyart": "https://ap.tft.tools/img/new17/keyart.png?w=960",
    
    # Ability icons
    "ability": "https://ap.tft.tools/img/new17/ability/TFT17_{Key}.png?w=22",
}

# {key} = lowercase no spaces: "aatrox", "chogath", "reksai", "twistedfate"
# {Key} = PascalCase: "Aatrox", "ChoGath", "RekSai", "TwistedFate"
```

**Scraping champion key mappings:**

```python
# Derive the tactics.tools key from cdragon apiName
def cdragon_to_tt_key(api_name):
    """TFT17_Aatrox -> aatrox, TFT17_ChoGath -> chogath"""
    name = api_name.split("_", 1)[1] if "_" in api_name else api_name
    return name.lower()

def cdragon_to_tt_pascal(api_name):
    """TFT17_Aatrox -> Aatrox, TFT17_ChoGath -> ChoGath"""
    return api_name.split("_", 1)[1] if "_" in api_name else api_name
```

### 3D. Scraping Strategy

```python
# scraper/scrape_all.py
# Run from TFT Clash project root: python scraper/scrape_all.py
# Outputs JSON to src/donut17/data/

import requests, json, os, time

OUTPUT_DIR = "src/donut17/data"
ASSETS_DIR = "public/donut17-assets"

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(f"{ASSETS_DIR}/faces", exist_ok=True)
    os.makedirs(f"{ASSETS_DIR}/traits", exist_ok=True)
    os.makedirs(f"{ASSETS_DIR}/gods", exist_ok=True)
    os.makedirs(f"{ASSETS_DIR}/items", exist_ok=True)
    os.makedirs(f"{ASSETS_DIR}/abilities", exist_ok=True)
    
    # NOTE: Run this scraper from the TFT Clash project root
    # It writes JSON into src/donut17/data/ and optional images into public/donut17-assets/
    
    # 1. Fetch and parse cdragon master data
    data = fetch_cdragon()
    
    champions = parse_champions(data)
    traits = parse_traits(data)
    items = parse_items(data)
    augments = parse_augments(data)
    
    # 2. Enrich with tactics.tools asset URLs
    for champ in champions:
        key = cdragon_to_tt_key(champ["apiName"])
        pascal = cdragon_to_tt_pascal(champ["apiName"])
        champ["assets"] = {
            "face": f"https://ap.tft.tools/img/new17/face/tft17_{key}.jpg?w=36",
            "face_lg": f"https://ap.tft.tools/img/new17/face/tft17_{key}.jpg?w=64",
            "wide": f"https://ap.tft.tools/img/new17/face_full_ultrawide/TFT17_{pascal}.jpg?w=290",
            "ability": f"https://ap.tft.tools/img/new17/ability/TFT17_{pascal}.png?w=22",
        }
        champ["key"] = key  # shorthand for frontend
    
    for trait in traits:
        # Derive trait icon key from apiName
        # e.g. "TFT17_DarkStar" -> "darkstar"
        trait_key = trait["apiName"].split("_", 1)[1].lower() if "_" in trait["apiName"] else trait["apiName"].lower()
        trait["key"] = trait_key
        trait["icon"] = f"https://ap.tft.tools/static/trait-icons/new17_tft17_{trait_key}_w.svg"
    
    # 3. Optionally download assets locally for offline use
    # (uncomment if you want local assets)
    # download_assets(champions, traits)
    
    # 4. Build the god data (not in cdragon — manually maintained or scraped from tactics.tools)
    gods = scrape_gods()
    
    # 5. Write all data
    write_json(f"{OUTPUT_DIR}/champions.json", champions)
    write_json(f"{OUTPUT_DIR}/traits.json", traits)
    write_json(f"{OUTPUT_DIR}/items.json", items)
    write_json(f"{OUTPUT_DIR}/augments.json", augments)
    write_json(f"{OUTPUT_DIR}/gods.json", gods)
    
    # 6. Build derived data
    build_synergy_grid(champions, traits)
    build_comp_lines(champions, traits)
    
    print(f"\nDone! {len(champions)} champions, {len(traits)} traits, {len(items)} items, {len(augments)} augments")

def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Wrote {path}")

def download_assets(champions, traits):
    """Download images locally for offline use."""
    for champ in champions:
        url = champ["assets"]["face"]
        path = f"{ASSETS_DIR}/faces/{champ['key']}.jpg"
        if not os.path.exists(path):
            try:
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    with open(path, "wb") as f:
                        f.write(r.content)
                    print(f"    Downloaded {champ['key']}")
                time.sleep(0.1)  # Be polite
            except Exception as e:
                print(f"    Failed {champ['key']}: {e}")
    
    for trait in traits:
        url = trait["icon"]
        path = f"{ASSETS_DIR}/traits/{trait['key']}.svg"
        if not os.path.exists(path):
            try:
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    with open(path, "wb") as f:
                        f.write(r.content)
                time.sleep(0.1)
            except Exception as e:
                print(f"    Failed trait {trait['key']}: {e}")

def scrape_gods():
    """God data is NOT in cdragon. Scrape from tactics.tools or maintain manually."""
    # The god data comes from the set update page or Riot's official reveal
    # This is best maintained as a manual JSON since it's small and stable
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
            "tip": "High risk. Best with reroll comps or Anima lose streak.",
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
            "image": "https://ap.tft.tools/img/new17/gods/yasuo.png?w=400",
        },
    ]

def build_synergy_grid(champions, traits):
    """Build the origin x class cross-reference grid."""
    origins = [t for t in traits if t.get("type") == "origin"]
    classes = [t for t in traits if t.get("type") == "class"]
    
    grid = {}
    for champ in champions:
        for origin_name in champ["traits"]:
            for class_name in champ["traits"]:
                o = next((t for t in origins if t["name"] == origin_name), None)
                c = next((t for t in classes if t["name"] == class_name), None)
                if o and c:
                    key = f"{o['name']}|{c['name']}"
                    if key not in grid:
                        grid[key] = []
                    grid[key].append(champ["key"])
    
    write_json(f"{OUTPUT_DIR}/synergy_grid.json", grid)

def build_comp_lines(champions, traits):
    """Build theorycrafted comp lines with trait scoring."""
    # This is maintained semi-manually with scraped data informing it
    # The comp lines should be updated as meta develops
    # See Section 6 for the full comp data structure
    pass

if __name__ == "__main__":
    main()
```

---

## 4. DATA SCHEMA

All JSON files live in `src/donut17/data/`. The Donut17 page imports them statically at build time. No Supabase, no runtime fetches.

### champions.json
```json
[
  {
    "apiName": "TFT17_Aatrox",
    "key": "aatrox",
    "name": "Aatrox",
    "cost": 1,
    "traits": ["NOVA", "Bastion"],
    "stats": {
      "hp": 600, "mana": 90, "initialMana": 30,
      "damage": 55, "armor": 35, "magicResist": 35,
      "attackSpeed": 0.65, "range": 1
    },
    "ability": {
      "name": "Stellar Slash",
      "desc": "Heal, then deal physical damage to the current target.",
      "variables": []
    },
    "assets": {
      "face": "https://ap.tft.tools/img/new17/face/tft17_aatrox.jpg?w=36",
      "face_lg": "https://ap.tft.tools/img/new17/face/tft17_aatrox.jpg?w=64",
      "wide": "https://ap.tft.tools/img/new17/face_full_ultrawide/TFT17_Aatrox.jpg?w=290",
      "ability": "https://ap.tft.tools/img/new17/ability/TFT17_Aatrox.png?w=22"
    },
    "role": "Tank",
    "bis": ["Warmog's Armor", "Gargoyle Stoneplate", "Dragon's Claw"]
  }
]
```

### traits.json
```json
[
  {
    "apiName": "TFT17_Bastion",
    "key": "bastion",
    "name": "Bastion",
    "desc": "Bastions gain Armor and Magic Resistance.",
    "type": "class",
    "icon": "https://ap.tft.tools/static/trait-icons/new17_tft17_bastion_w.svg",
    "effects": [
      { "minUnits": 2, "maxUnits": 3, "variables": { "Armor": 25, "MR": 25 } },
      { "minUnits": 4, "maxUnits": 5, "variables": { "Armor": 55, "MR": 55 } },
      { "minUnits": 6, "maxUnits": 25, "variables": { "Armor": 100, "MR": 100 } }
    ]
  }
]
```

### items.json
```json
[
  {
    "apiName": "TFT_Item_BFSword",
    "name": "B.F. Sword",
    "desc": "+10 Attack Damage",
    "effects": { "AD": 10 },
    "from": [],
    "icon": "/path/to/icon"
  },
  {
    "apiName": "TFT_Item_InfinityEdge",
    "name": "Infinity Edge",
    "desc": "+35 AD. Abilities can critically strike.",
    "effects": { "AD": 35, "CritChance": 35 },
    "from": ["TFT_Item_BFSword", "TFT_Item_SparringGloves"],
    "icon": "/path/to/icon"
  }
]
```

### gods.json
```json
[
  {
    "name": "Ahri",
    "key": "ahri",
    "title": "God of Opulence",
    "color": "#f472b6",
    "blessing": "Gain 2 gold, 2 XP, and 2 rerolls each round",
    "offerings": {
      "stage2": ["6 gold", "8 XP", "5 rerolls"],
      "stage3": ["8 gold", "7 rerolls", "10 XP"],
      "stage4": ["12 gold", "8 rerolls"]
    },
    "tip": "Best for fast 8/9 strategies.",
    "image": "https://ap.tft.tools/img/new17/gods/ahri.png?w=400"
  }
]
```

### comp_lines.json
```json
[
  {
    "id": "darkstar",
    "name": "Dark Star Vertical",
    "color": "#7c3aed",
    "carry": "Jhin",
    "desc": "Scale Black Holes. Jhin 5-cost carry.",
    "core": ["chogath", "lissandra", "mordekaiser", "kaisa", "karma", "jhin"],
    "flex": ["shen", "morgana", "nunu"],
    "items": {
      "carry": ["Jhin: IE + LW + GS"],
      "tank": ["Mordekaiser: Warmog + Gargoyle + DClaw"]
    },
    "god": "Varus",
    "godWhy": "+4% five-cost odds helps hit Jhin",
    "gameplan": "Cho+Liss early -> Morde 2 -> Kai'Sa 3 -> roll 8 for Karma+Jhin"
  }
]
```

---

## 5. INTEGRATION INTO TFT CLASH

### 5A. Route Setup

Add the `/donut17` route to the existing TFT Clash router. This page is **NOT** gated behind auth, does **NOT** use `useApp()`, and is **NOT** linked from any existing navigation.

```jsx
// In the existing router (App.jsx or wherever routes are defined)
// Add this route alongside the existing ones:

<Route path="/donut17" element={<Donut17Page />} />
```

The `Donut17Page` component is fully self-contained — it manages its own state with local `useState`/`useMemo`, loads its own fonts, and has its own styling scope. It does NOT import `useApp`, does NOT read from Supabase, does NOT interact with TFT Clash state whatsoever.

### 5B. File Structure (inside existing TFT Clash project)

```
src/
├── ... (existing TFT Clash files, don't touch)
│
└── donut17/                       # ALL Donut17 code lives here
    ├── Donut17Page.jsx            # Root page component (mounted at /donut17)
    ├── data/                      # Scraped JSON (static imports)
    │   ├── champions.json
    │   ├── traits.json
    │   ├── items.json
    │   ├── augments.json
    │   ├── gods.json
    │   ├── comp_lines.json
    │   └── synergy_grid.json
    ├── hooks/
    │   └── useOpenerAdvisor.js    # Comp scoring logic
    ├── components/
    │   ├── ChampIcon.jsx          # Reusable champ portrait
    │   ├── TraitBadge.jsx         # Trait icon + name
    │   ├── CostBadge.jsx          # Colored cost indicator
    │   ├── ItemIcon.jsx           # Item with tooltip
    │   └── GodCard.jsx            # God display card
    └── tabs/
        ├── OpenerAdvisor.jsx      # THE BIG ONE
        ├── SynergyGrid.jsx
        ├── Champions.jsx
        ├── CompLines.jsx
        ├── Gods.jsx
        ├── Items.jsx              # stretch
        └── Augments.jsx           # stretch

scraper/                           # Lives at project root, NOT in src/
├── scrape_all.py                  # Master scraper
├── requirements.txt               # requests, beautifulsoup4
└── README.md
```

### 5C. Isolation Rules

These are non-negotiable to keep Donut17 from breaking TFT Clash:

1. **No imports from outside `src/donut17/`** — Donut17 never imports TFT Clash components, hooks, utils, or styles
2. **No `useApp()` hook** — Donut17 manages all its own state locally
3. **No Supabase** — All data comes from static JSON files in `src/donut17/data/`
4. **No modifications to existing files** — The ONLY change to existing TFT Clash code is adding the one `<Route>` line
5. **Self-contained styling** — Donut17 uses inline styles or a scoped CSS class prefix (e.g. `.d17-`) to avoid polluting TFT Clash styles. Tailwind utility classes are fine since they're already global.
6. **No nav links** — Do NOT add Donut17 to any sidebar, header, footer, or navigation component. URL-only access.

---

## 6. FEATURE SPEC PER TAB

### Tab 1: OPENER ADVISOR (default tab, hero feature)

**Purpose**: User selects 1-2 cost champions found in stage 1-2. System recommends best comp lines.

**UX Flow**:
1. Grid of all 1-cost and 2-cost champion portraits (clickable, toggle selection)
2. As user selects, show "Active Traits" panel counting trait overlaps
3. Below, show all comp lines RANKED by match score
4. Top match gets a "BEST MATCH" badge and green highlight
5. Each comp card shows: core board portraits, BIS items, game plan, recommended god

**Scoring Algorithm**:
```javascript
function scoreComp(comp, selectedChampKeys, allChamps) {
  let score = 0;
  const selectedTraits = [];
  
  selectedChampKeys.forEach(key => {
    const ch = allChamps.find(c => c.key === key);
    if (ch) selectedTraits.push(...ch.traits);
  });
  
  comp.core.forEach(key => {
    // Direct unit match = 3 points
    if (selectedChampKeys.includes(key)) score += 3;
    
    // Trait overlap = 1 point per shared trait
    const ch = allChamps.find(c => c.key === key);
    if (ch) {
      ch.traits.forEach(t => {
        if (selectedTraits.includes(t)) score += 1;
      });
    }
  });
  
  return score;
}
```

### Tab 2: SYNERGY GRID

**Purpose**: Origin x Class matrix from the spreadsheet.

**Requirements**:
- Sticky first column (origin names)
- Hover highlight on row/column headers
- Champion portraits at intersections with cost-colored borders
- Click a cell to see champion details
- Below the grid: origin effects legend + class effects legend (two columns)
- Unique 5-cost traits displayed in a separate callout box

### Tab 3: CHAMPIONS

**Purpose**: Browse all champions by cost tier.

**Requirements**:
- Search bar + cost filter buttons (1-5)
- Group by cost tier with colored headers
- Each champion card shows: portrait, name, origin badges, class badges, role tag, unique trait (if any)
- Click to expand: full stats, ability description, BIS items
- Cost border colors: 1=gray, 2=green, 3=blue, 4=purple, 5=gold

### Tab 4: COMP LINES

**Purpose**: Pre-built theorycrafted compositions.

**Requirements**:
- 10 comp lines with full details
- Each comp shows: name, carry, description, core board (portraits), flex units, BIS items (carry + tank), game plan (stage by stage text), recommended god + reasoning
- Visual distinction between core and flex units (separator line)
- Comp colors for visual identity

### Tab 5: GODS

**Purpose**: Full Realm of the Gods reference.

**Requirements**:
- All 9 gods with portraits
- Stage 2 / Stage 3 / Stage 4 offering breakdowns in columns
- 4-7 Blessing prominently displayed
- Strategic tips per god
- God synergy notes (which comps pair best with which gods)

### Tab 6: ITEMS (stretch goal)

**Purpose**: Item cheat sheet.

**Requirements**:
- Component grid showing all 2-item combinations
- Hover shows resulting item
- BIS items per carry champion
- Item categories: AD carry items, AP carry items, Tank items, Utility

### Tab 7: AUGMENTS (stretch goal)

**Purpose**: Augment reference.

**Requirements**:
- Grouped by tier (Silver / Gold / Prismatic)
- Searchable
- Hero Augments highlighted separately
- Brief description per augment

---

## 7. STYLING SPEC

**Theme**: Dark cosmic / space opera. NOT generic dark mode. This is visually distinct from TFT Clash's main aesthetic on purpose.

**Scoping**: The Donut17Page root element wraps everything in a container div with its own background and font-family. This prevents style bleed into TFT Clash. Tailwind utility classes are safe to use since they're atomic. Avoid adding global CSS rules — keep everything inline or scoped via Tailwind.

```css
/* These are CSS variables used within Donut17 components only */
/* Define them on the root Donut17 container div via inline style or a scoped class */

--d17-bg-deep: #080c18;
--d17-bg-surface: #0f1629;
--d17-bg-card: rgba(15, 23, 42, 0.5);
--d17-border: #1e293b;
--d17-text-primary: #e2e8f0;
--d17-text-secondary: #94a3b8;
--d17-text-muted: #475569;
--d17-accent-purple: #a78bfa;
--d17-accent-blue: #60a5fa;
--d17-cost-1: #9ca3af;
--d17-cost-2: #22c55e;
--d17-cost-3: #3b82f6;
--d17-cost-4: #a855f7;
--d17-cost-5: #eab308;
```

**Fonts** (load from Google Fonts):
- Headings: `'Orbitron', monospace` — weight 700/900
- UI: `'Chakra Petch', sans-serif` — weight 400/600/700
- Numbers/code: `'JetBrains Mono', monospace`

**Image error handling**: Every `<img>` must have an `onError` handler that gracefully degrades (set opacity to 0.2 or show a fallback colored div).

---

## 8. CODE CONSTRAINTS

Same constraints as the rest of TFT Clash, EXCEPT where noted:

**Inherited from TFT Clash:**
- No arrow function components (use `function ComponentName() {}`)
- No `var`, always `const` / `let`
- No backtick literals in JSX render blocks
- No optional chaining calls `?.()`
- No IIFEs in JSX
- No `React.Fragment` — use `<>` shorthand
- Brace balance must always be zero

**Donut17-specific overrides:**
- Do NOT use `useApp()` — this page has no TFT Clash state
- Do NOT import from outside `src/donut17/`
- State is local via `useState`, `useMemo`, `useCallback` only
- JSON data imported statically (no Supabase, no runtime fetch)
- Tailwind utility classes for layout, inline styles only for dynamic values from data
- Every component in its own file inside `src/donut17/`
- Donut17 fonts (Chakra Petch, Orbitron) loaded inside the Donut17Page component, not in index.html

---

## 9. SCRAPER EXECUTION ORDER

```bash
# 1. Setup (from TFT Clash project root)
cd tft-clash  # or whatever the project root is called
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install requests beautifulsoup4

# 2. Run scraper (outputs to src/donut17/data/)
python scraper/scrape_all.py

# 3. Verify output
ls src/donut17/data/
# Should see: champions.json, traits.json, items.json, augments.json, gods.json

# 4. Dev server (same as normal TFT Clash)
npm run dev
# Navigate to localhost:xxxx/donut17

# 5. Deploy (deploys with TFT Clash as usual)
# After push, accessible at tftclash.com/donut17
```

**NOTE**: The scraper writes directly into `src/donut17/data/`. These JSON files are committed to git — they're build-time dependencies, not runtime artifacts. Re-run the scraper whenever PBE patches drop to get updated numbers.

---

## 10. KNOWN GOTCHAS

1. **cdragon JSON structure shifts between sets**. The scraper MUST inspect the actual JSON first. Print top-level keys, check for `setData`, `sets`, `champions` etc. Do NOT hardcode paths blindly.

2. **Trait type classification** (origin vs class) may not be explicitly labeled in cdragon. You may need to classify based on the trait `apiName` or by checking which traits are in the "origin" vs "class" category. Look for a `type` field or infer from the UI position.

3. **tactics.tools image keys** are case-sensitive. Face images use lowercase (`tft17_aatrox`), wide portraits use PascalCase in the filename (`TFT17_Aatrox`). The `?w=` param controls size.

4. **God data is NOT in cdragon**. The gods are a UI/game mechanic, not champion/trait data. God data must be maintained manually or scraped from the tactics.tools set update page HTML.

5. **Augment data** in cdragon sometimes mixes set-specific augments with generic ones. Filter by `apiName` containing `TFT17` or the set number.

6. **Champion costs on PBE shift frequently**. The scraper should always pull fresh data. Don't cache costs as constants.

7. **Zed is augment-only** — he comes from the "Invader Zed" Hero Augment. He may or may not appear in the champion pool data. Handle gracefully.

8. **Mecha transform** makes a unit take 2 team slots. This affects comp building logic.

9. **5-cost unique traits** (Redeemer, Factory New, Dark Lady, Doomer, Galaxy Hunter, Bulwark, Oracle, Gun Goddess, Divine Duelist) are single-champion traits. They appear as traits in the data but should be displayed differently in the UI.

10. **Vercel SPA routing** — TFT Clash should already have a `vercel.json` or similar rewrite rule that sends all routes to `index.html`. If not, `/donut17` will 404 on direct navigation. Make sure the catch-all rewrite exists:
    ```json
    { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
    ```

11. **Don't break TFT Clash** — Before committing, verify that ALL existing TFT Clash pages still work. The only file touched outside `src/donut17/` should be the router file where the single `<Route>` line is added.

---

## 11. ACCEPTANCE CRITERIA

**Integration:**
- [ ] `/donut17` route renders the Donut17Page component
- [ ] No other TFT Clash page or navigation links to `/donut17`
- [ ] Donut17 does NOT import `useApp()` or any TFT Clash modules
- [ ] Donut17 does NOT touch Supabase
- [ ] Existing TFT Clash pages are completely unaffected (no regressions)
- [ ] All Donut17 code lives inside `src/donut17/`
- [ ] Vercel deploy works — `tftclash.com/donut17` loads correctly

**Functionality:**
- [ ] Scraper runs clean and produces all 5+ JSON files into `src/donut17/data/`
- [ ] All champion portraits load from tactics.tools CDN
- [ ] All trait icons load from tactics.tools CDN
- [ ] Synergy grid matches the Google Sheet data
- [ ] Opener Advisor correctly scores and ranks comps based on selected units
- [ ] All 9 gods display with stage-by-stage offerings
- [ ] Cost colors are correct (1=gray, 2=green, 3=blue, 4=purple, 5=gold)
- [ ] No console errors on the Donut17 page
- [ ] All images have error fallbacks
- [ ] Mobile-responsive (scroll horizontal on grid, stack cards vertical)
- [ ] Search/filter works on Champions tab

---

## 12. STRETCH GOALS (post-launch)

1. **Live PBE patch tracking** — Re-run scraper after PBE patches, diff the JSON
2. **Item builder** — Interactive component grid to plan items
3. **Board positioning** — 4x7 hex grid to plan unit placement
4. **Meta tracking** — Once tactics.tools has winrate data, pull it in
5. **Augment tier list** — Rate augments per comp line
6. **Emblem lines** — Which emblem works in which comp (from the sheet's "Emblem Lines" tab)
7. **Anima Breakpoint Calculator** — Calculate tech thresholds (from the sheet tab)
8. **Stargazer Analysis** — Constellation-specific strategies (from the sheet tab)
