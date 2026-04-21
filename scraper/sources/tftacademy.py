"""tftacademy.com scraper -- curated comps + guides."""
from __future__ import annotations

from typing import Any

from .base import extract_next_data, fetch_html, safe_float

URLS = [
    "https://tftacademy.com/tierlist/comps",
    "https://tftacademy.com/set-17/comps",
]


def fetch() -> dict[str, Any]:
    out: dict[str, Any] = {"comps": {}, "gods": {}}
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
        name = node.get("name") or node.get("compName") or node.get("title")
        tier = node.get("tier")
        god = node.get("god") or node.get("patron")
        avg = node.get("avgPlace") or node.get("averagePlacement")
        if name and (tier or avg is not None):
            out["comps"][str(name).strip()] = {
                "tier": str(tier).upper() if tier else None,
                "avg_placement": safe_float(avg),
                "god": god,
            }
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)
