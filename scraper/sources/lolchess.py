"""lolchess.gg scraper -- augment tier list."""
from __future__ import annotations

from typing import Any

from .base import extract_next_data, fetch_html, safe_float

URLS = [
    "https://lolchess.gg/meta",
    "https://lolchess.gg/statistics/augments",
]


def fetch() -> dict[str, Any]:
    out: dict[str, Any] = {"augments": {}, "comps": {}}
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
        api = node.get("apiName") or node.get("ingameKey") or node.get("augment")
        tier = node.get("tier") or node.get("tierRank")
        avg = node.get("avgPlace") or node.get("averagePlacement")
        if api and (tier or avg is not None):
            key = str(api)
            if "Augment" in key or "TFT" in key:
                out["augments"][key] = {
                    "tier": str(tier).upper() if tier else None,
                    "avg_placement": safe_float(avg),
                }
        name = node.get("name") or node.get("compName")
        if name and tier and not api:
            out["comps"][str(name).strip()] = {
                "tier": str(tier).upper(),
                "avg_placement": safe_float(avg),
            }
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)
