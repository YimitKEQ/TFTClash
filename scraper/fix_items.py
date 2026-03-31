"""
fix_items.py - Post-process items.json into a clean categorized dataset.
Run from project root: python scraper/fix_items.py
Outputs src/donut17/data/items_clean.json
"""

import json
import re

INPUT = "src/donut17/data/items.json"
OUTPUT = "src/donut17/data/items_clean.json"

# ── Base components ──────────────────────────────────────────────────────────
COMPONENTS = [
    {"apiName": "TFT_Item_BFSword",           "key": "bfsword",           "name": "B.F. Sword",           "tags": ["ad"],          "category": "component"},
    {"apiName": "TFT_Item_RecurveBow",         "key": "recurvebow",        "name": "Recurve Bow",          "tags": ["as"],          "category": "component"},
    {"apiName": "TFT_Item_NeedlesslyLargeRod", "key": "nlrod",             "name": "Needlessly Large Rod", "tags": ["ap"],          "category": "component"},
    {"apiName": "TFT_Item_TearOfTheGoddess",   "key": "tear",              "name": "Tear of the Goddess",  "tags": ["mana"],        "category": "component"},
    {"apiName": "TFT_Item_ChainVest",          "key": "chainvest",         "name": "Chain Vest",           "tags": ["armor"],       "category": "component"},
    {"apiName": "TFT_Item_NegatronCloak",      "key": "negatroncloak",     "name": "Negatron Cloak",       "tags": ["mr"],          "category": "component"},
    {"apiName": "TFT_Item_GiantsBelt",         "key": "giantsbelt",        "name": "Giant's Belt",         "tags": ["hp"],          "category": "component"},
    {"apiName": "TFT_Item_SparringGloves",     "key": "sparringgloves",    "name": "Sparring Gloves",      "tags": ["crit"],        "category": "component"},
    {"apiName": "TFT_Item_Spatula",            "key": "spatula",           "name": "Spatula",              "tags": ["special"],     "category": "component"},
]

# ── Standard combined items ───────────────────────────────────────────────────
# recipe = [component_key, component_key]
COMBINED = [
    # AD carries
    {"apiName": "TFT_Item_Deathblade",          "key": "deathblade",        "name": "Deathblade",            "acronym": "DB",      "tags": ["ad"],           "recipe": ["bfsword",       "bfsword"],         "category": "combined"},
    {"apiName": "TFT_Item_GuinsoosRageblade",   "key": "guinsoosrageblade", "name": "Guinsoo's Rageblade",   "acronym": "RB",      "tags": ["ad", "ap"],     "recipe": ["bfsword",       "recurvebow"],      "category": "combined"},
    {"apiName": "TFT_Item_RunaansHurricane",    "key": "krakensfury",       "name": "Kraken's Fury",         "acronym": "RFC",     "tags": ["ad", "as"],     "recipe": ["recurvebow",    "recurvebow"],      "category": "combined"},
    {"apiName": "TFT_Item_InfinityEdge",        "key": "infinityedge",      "name": "Infinity Edge",         "acronym": "IE",      "tags": ["ad", "crit"],   "recipe": ["bfsword",       "sparringgloves"],  "category": "combined"},
    {"apiName": "TFT_Item_LastWhisper",         "key": "lastwhisper",       "name": "Last Whisper",          "acronym": "LW",      "tags": ["ad", "arpen"],  "recipe": ["recurvebow",    "bfsword"],         "category": "combined"},
    {"apiName": "TFT_Item_MadredsBloodrazor",   "key": "giantslayer",       "name": "Giant Slayer",          "acronym": "GS",      "tags": ["ad"],           "recipe": ["bfsword",       "recurvebow"],      "category": "combined"},
    {"apiName": "TFT_Item_Bloodthirster",       "key": "bloodthirster",     "name": "Bloodthirster",         "acronym": "BT",      "tags": ["ad", "life"],   "recipe": ["bfsword",       "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_SpearOfShojin",       "key": "spearofshojin",     "name": "Spear of Shojin",       "acronym": "SoS",     "tags": ["ad", "mana"],   "recipe": ["bfsword",       "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_YoumuusGhostblade",   "key": "youmuus",           "name": "Youmuu's Ghostblade",   "acronym": "YG",      "tags": ["ad"],           "recipe": ["bfsword",       "negatroncloak"],   "category": "combined"},
    # AP carries
    {"apiName": "TFT_Item_RabadonsDeathcap",    "key": "rabadons",          "name": "Rabadon's Deathcap",    "acronym": "Rabadon", "tags": ["ap"],           "recipe": ["nlrod",         "nlrod"],           "category": "combined"},
    {"apiName": "TFT_Item_JeweledGauntlet",     "key": "jeweledgauntlet",   "name": "Jeweled Gauntlet",      "acronym": "JG",      "tags": ["ap", "crit"],   "recipe": ["nlrod",         "sparringgloves"],  "category": "combined"},
    {"apiName": "TFT_Item_SeraphsEmbrace",      "key": "bluebuff",          "name": "Blue Buff",             "acronym": "BB",      "tags": ["ap", "mana"],   "recipe": ["nlrod",         "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_ArchangelsStaff",     "key": "archangels",        "name": "Archangel's Staff",     "acronym": "AA",      "tags": ["ap", "mana"],   "recipe": ["nlrod",         "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_Leviathan",           "key": "nashors",           "name": "Nashor's Tooth",        "acronym": "NT",      "tags": ["ap", "as"],     "recipe": ["nlrod",         "recurvebow"],      "category": "combined"},
    {"apiName": "TFT_Item_IonicSpark",          "key": "ionicspark",        "name": "Ionic Spark",           "acronym": "IS",      "tags": ["ap", "mr"],     "recipe": ["nlrod",         "negatroncloak"],   "category": "combined"},
    {"apiName": "TFT_Item_Morellonomicon",      "key": "morellonomicon",    "name": "Morellonomicon",        "acronym": "Morellos","tags": ["ap"],            "recipe": ["nlrod",         "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_StatikkShiv",         "key": "voidstaff",         "name": "Void Staff",            "acronym": "VS",      "tags": ["ap", "mppen"],  "recipe": ["nlrod",         "recurvebow"],      "category": "combined"},
    # Tank
    {"apiName": "TFT_Item_WarmogsArmor",        "key": "warmogsarmor",      "name": "Warmog's Armor",        "acronym": "Warmog",  "tags": ["tank", "hp"],   "recipe": ["giantsbelt",    "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_GargoyleStoneplate",  "key": "gargoyle",          "name": "Gargoyle Stoneplate",   "acronym": "Garg",    "tags": ["tank"],         "recipe": ["chainvest",     "negatroncloak"],   "category": "combined"},
    {"apiName": "TFT_Item_BrambleVest",         "key": "bramblevest",       "name": "Bramble Vest",          "acronym": "BV",      "tags": ["tank", "armor"],"recipe": ["chainvest",     "chainvest"],       "category": "combined"},
    {"apiName": "TFT_Item_DragonsClaw",         "key": "dragonsclaw",       "name": "Dragon's Claw",         "acronym": "DC",      "tags": ["tank", "mr"],   "recipe": ["negatroncloak", "negatroncloak"],   "category": "combined"},
    {"apiName": "TFT_Item_TitansResolve",       "key": "titansresolve",     "name": "Titan's Resolve",       "acronym": "TR",      "tags": ["tank", "ad"],   "recipe": ["chainvest",     "recurvebow"],      "category": "combined"},
    {"apiName": "TFT_Item_RedBuff",             "key": "sunfirecape",       "name": "Sunfire Cape",          "acronym": "SC",      "tags": ["tank", "burn"],  "recipe": ["chainvest",     "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_SteraksGage",         "key": "steraksgage",       "name": "Sterak's Gage",         "acronym": "Sterak",  "tags": ["tank", "hp"],   "recipe": ["chainvest",     "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_AdaptiveHelm",        "key": "adaptivehelm",      "name": "Adaptive Helm",         "acronym": "AH",      "tags": ["tank", "mr"],   "recipe": ["negatroncloak", "tear"],            "category": "combined"},
    # Utility
    {"apiName": "TFT_Item_LocketOfTheIronSolari","key": "locket",           "name": "Locket of the Iron Solari","acronym": "Locket","tags": ["utility"],     "recipe": ["chainvest",     "nlrod"],           "category": "combined"},
    {"apiName": "TFT_Item_Redemption",          "key": "spiritvisage",      "name": "Spirit Visage",         "acronym": "Redemp",  "tags": ["utility","hp"], "recipe": ["tear",          "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_UnstableConcoction",  "key": "handofjustice",     "name": "Hand of Justice",       "acronym": "HoJ",     "tags": ["utility","ad","ap"],"recipe": ["sparringgloves","tear"],         "category": "combined"},
    {"apiName": "TFT_Item_GuardianAngel",       "key": "edgeofnight",       "name": "Edge of Night",         "acronym": "EoN",     "tags": ["utility","ad"], "recipe": ["chainvest",     "bfsword"],         "category": "combined"},
    {"apiName": "TFT_Item_KnightsVow",          "key": "knightsvow",        "name": "Knight's Vow",          "acronym": "KV",      "tags": ["utility"],      "recipe": ["chainvest",     "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_ZekesHerald",         "key": "zekesherald",       "name": "Zeke's Herald",         "acronym": "Zeke",    "tags": ["utility","as"], "recipe": ["bfsword",       "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_Chalice",             "key": "chalice",           "name": "Chalice of Power",      "acronym": "Chalice", "tags": ["utility","ap"], "recipe": ["nlrod",         "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_Quicksilver",         "key": "quicksilver",       "name": "Quicksilver",           "acronym": "QSS",     "tags": ["utility","mr"], "recipe": ["negatroncloak", "sparringgloves"],  "category": "combined"},
    {"apiName": "TFT_Item_Zephyr",              "key": "zephyr",            "name": "Zephyr",                "acronym": "Zephyr",  "tags": ["utility"],      "recipe": ["negatroncloak", "giantsbelt"],      "category": "combined"},
    {"apiName": "TFT_Item_BansheesVeil",        "key": "bansheesveil",      "name": "Banshee's Veil",        "acronym": "BV",      "tags": ["utility","mr"], "recipe": ["negatroncloak", "nlrod"],           "category": "combined"},
    {"apiName": "TFT_Item_Crownguard",          "key": "crownguard",        "name": "Crownguard",            "acronym": "CG",      "tags": ["utility","ap"], "recipe": ["chainvest",     "nlrod"],           "category": "combined"},
    {"apiName": "TFT_Item_Moonstone",           "key": "moonstone",         "name": "Moonstone Renewer",     "acronym": "MS",      "tags": ["utility"],      "recipe": ["chainvest",     "tear"],            "category": "combined"},
    {"apiName": "TFT_Item_NightHarvester",      "key": "steadfastheart",    "name": "Steadfast Heart",       "acronym": "SH",      "tags": ["utility","hp"], "recipe": ["giantsbelt",    "sparringgloves"],  "category": "combined"},
    {"apiName": "TFT_Item_ThiefsGloves",        "key": "thiefsgloves",      "name": "Thief's Gloves",        "acronym": "TG",      "tags": ["special"],      "recipe": ["sparringgloves","sparringgloves"],  "category": "combined"},
]


def clean_icon(url):
    if not url:
        return ""
    return url.replace(".tex", ".png")


def clean_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"@[^@]+@", "X", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()[:220]


def main():
    with open(INPUT, encoding="utf-8") as f:
        raw = json.load(f)
    item_map = {x["apiName"]: x for x in raw}

    result = []

    # Components
    for meta in COMPONENTS:
        r = item_map.get(meta["apiName"], {})
        result.append({
            **meta,
            "icon": clean_icon(r.get("icon", "")),
            "desc": clean_html(r.get("desc", "")),
        })

    # Combined
    for meta in COMBINED:
        r = item_map.get(meta["apiName"], {})
        if not r:
            continue
        result.append({
            **meta,
            "icon": clean_icon(r.get("icon", "")),
            "desc": clean_html(r.get("desc", "")),
        })

    # Artifacts (standard TFT_Item_Artifact_*)
    for r in raw:
        api = r["apiName"]
        if "Artifact_" not in api or api.startswith("TFT17_"):
            continue
        name = clean_html(r.get("name", ""))
        if not name or name.startswith("@") or name.startswith("tft_") or name.startswith("game_") or "<" in name:
            continue
        key = re.sub(r"[^a-z0-9]", "", api.lower().replace("tft_item_artifact_", ""))
        result.append({
            "apiName": api,
            "key": key,
            "name": name,
            "tags": ["artifact"],
            "category": "artifact",
            "icon": clean_icon(r.get("icon", "")),
            "desc": clean_html(r.get("desc", "")),
        })

    # Set17 artifacts (god-specific)
    for r in raw:
        api = r["apiName"]
        if not api.startswith("TFT17_Item_Artifact"):
            continue
        name = clean_html(r.get("name", ""))
        if not name or name.startswith("@") or "<" in name or "Radiant" in api:
            continue
        key = re.sub(r"[^a-z0-9]", "", api.lower().replace("tft17_item_artifact_", "goditem_"))
        result.append({
            "apiName": api,
            "key": key,
            "name": name,
            "tags": ["artifact", "set17"],
            "category": "artifact",
            "icon": clean_icon(r.get("icon", "")),
            "desc": clean_html(r.get("desc", "")),
        })

    # Set17 PsyOps mods
    for r in raw:
        api = r["apiName"]
        if not api.startswith("TFT17_Item_PsyOps"):
            continue
        if "Radiant" in api:
            continue
        name = clean_html(r.get("name", ""))
        if not name or name.startswith("@") or "<" in name:
            continue
        key = re.sub(r"[^a-z0-9]", "", api.lower().replace("tft17_item_", ""))
        result.append({
            "apiName": api,
            "key": key,
            "name": name,
            "tags": ["set17", "psyops"],
            "category": "set17",
            "icon": clean_icon(r.get("icon", "")),
            "desc": clean_html(r.get("desc", "")),
        })

    # Trait emblems
    for r in raw:
        api = r["apiName"]
        if not api.startswith("TFT17_Item_") or "EmblemItem" not in api:
            continue
        name = clean_html(r.get("name", ""))
        if not name or name.startswith("@") or "<" in name:
            continue
        key = re.sub(r"[^a-z0-9]", "", api.lower().replace("tft17_item_", ""))
        result.append({
            "apiName": api,
            "key": key,
            "name": name,
            "tags": ["emblem", "spatula"],
            "category": "emblem",
            "icon": clean_icon(r.get("icon", "")),
            "desc": "Grants the holder this trait.",
        })

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    cats = {}
    for x in result:
        cats[x["category"]] = cats.get(x["category"], 0) + 1
    print("Wrote {} items to {}".format(len(result), OUTPUT))
    print("Categories:", cats)


if __name__ == "__main__":
    main()
