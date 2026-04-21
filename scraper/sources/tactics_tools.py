"""tactics.tools scraper -- unit play rates + avg placement by champion."""
from __future__ import annotations

from typing import Any

from .base import extract_next_data, fetch_html, safe_float

URLS = [
    "https://tactics.tools/champions",
    "https://tactics.tools/comps",
]


def fetch() -> dict[str, Any]:
    out: dict[str, Any] = {"units": {}, "comps": {}}
    for url in URLS:
        html = fetch_html(url)
        if not html:
            continue
        nd = extract_next_data(html)
        if not nd:
            continue
        _walk(nd, out)
    return out


def _walk(node: Any, out: dict[str, Any]) -> None:
    if isinstance(node, dict):
        # unit shape
        key = node.get("apiName") or node.get("champion") or node.get("unit")
        if key and ("avgPlace" in node or "averagePlacement" in node or "pickRate" in node):
            k = str(key).split("_", 1)[-1].lower()
            out["units"][k] = {
                "avg_placement": safe_float(node.get("avgPlace") or node.get("averagePlacement")),
                "play_rate": safe_float(node.get("pickRate") or node.get("playRate")),
            }
        # comp shape
        name = node.get("name") or node.get("compName")
        tier = node.get("tier")
        if name and tier:
            out["comps"][str(name).strip()] = {
                "tier": str(tier).upper(),
                "avg_placement": safe_float(node.get("avgPlace") or node.get("averagePlacement")),
            }
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)
