"""metatft.com scraper -- comp tiers + avg placement for TFT Set 17."""
from __future__ import annotations

from typing import Any

from .base import extract_next_data, fetch_html, safe_float

URLS = [
    "https://www.metatft.com/comps",
    "https://www.metatft.com/tierlist",
]


def fetch() -> dict[str, Any]:
    """Return {'comps': {name: {tier, avg_placement, play_rate}}}."""
    out: dict[str, Any] = {"comps": {}, "units": {}}
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
    """Walk JSON tree looking for comp/unit objects with tier + placement fields."""
    if isinstance(node, dict):
        name = node.get("name") or node.get("compName") or node.get("title")
        tier = node.get("tier") or node.get("tierRank")
        avg = node.get("avgPlace") or node.get("avg_place") or node.get("averagePlacement")
        play = node.get("playRate") or node.get("play_rate") or node.get("pickRate")
        if name and (tier or avg is not None):
            key = str(name).strip()
            out["comps"][key] = {
                "tier": str(tier).upper() if tier else None,
                "avg_placement": safe_float(avg),
                "play_rate": safe_float(play),
            }
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)
