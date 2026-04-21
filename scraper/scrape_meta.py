"""
Donut17 Meta Scraper -- aggregates comp tiers, unit avg placement, and augment tiers
from 4 public sites (metatft, tactics.tools, lolchess, tftacademy).

Writes src/donut17/data/meta.json with the shape consumed by Donut17 tabs:

    {
      "updated_at": "<iso>",
      "sources": [...],
      "comps":     { "<comp id or name>": {tier, avg_placement, play_rate} },
      "champions": { "<champion key>":    {avg_placement, play_rate} },
      "augments":  { "<augment apiName>": {tier, avg_placement} }
    }

Run from project root:  python scraper/scrape_meta.py
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import time
from typing import Any

# Ensure package-relative imports work when run as a script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sources import lolchess, metatft, tactics_tools, tftacademy  # noqa: E402

OUTPUT = "src/donut17/data/meta.json"

SOURCES: list[tuple[str, Any]] = [
    ("metatft.com", metatft),
    ("tactics.tools", tactics_tools),
    ("lolchess.gg", lolchess),
    ("tftacademy.com", tftacademy),
]


def merge_map(dest: dict[str, Any], src: dict[str, Any]) -> None:
    """Merge src into dest. Fields already set in dest are kept (first-source-wins)."""
    for key, val in src.items():
        if key not in dest:
            dest[key] = dict(val)
            continue
        for field, fv in val.items():
            if fv is not None and dest[key].get(field) is None:
                dest[key][field] = fv


def main() -> None:
    print(f"Donut17 meta scraper -- {dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")}Z")
    print("-" * 60)

    out: dict[str, Any] = {
        "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sources": [],
        "comps": {},
        "champions": {},
        "augments": {},
    }

    for label, module in SOURCES:
        print(f"Scraping {label}...")
        started = time.time()
        try:
            result = module.fetch() or {}
        except Exception as exc:  # noqa: BLE001
            print(f"  -- {label} failed: {exc}")
            continue
        elapsed = time.time() - started
        comps = result.get("comps", {})
        units = result.get("units", {})
        augs = result.get("augments", {})
        print(f"  comps={len(comps)}  units={len(units)}  augments={len(augs)}  ({elapsed:.1f}s)")
        out["sources"].append({
            "name": label,
            "comps": len(comps),
            "units": len(units),
            "augments": len(augs),
        })
        merge_map(out["comps"], comps)
        merge_map(out["champions"], units)
        merge_map(out["augments"], augs)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print("-" * 60)
    print(f"Wrote {OUTPUT}")
    print(f"  comps={len(out['comps'])}  champions={len(out['champions'])}  augments={len(out['augments'])}")
    if not (out["comps"] or out["champions"] or out["augments"]):
        print("  WARNING: all sources returned empty. Tabs will render without meta overlays.")


if __name__ == "__main__":
    main()
