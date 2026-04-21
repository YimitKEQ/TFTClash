"""
Scrape tftflow.com Set 17 comps verbatim.

Outputs scraper/sources/tftflow_set17.json with one entry per unique comp:
  {
    slug, name, url, econ, tiers[], og_desc,
    board[{apiName, name, cost, carry}],
    carries[apiName], augments[],
    patch (string if detectable)
  }

No curation, no decisions — the tier list / detail pages are the source of truth.
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "scraper" / "sources"
OUT_DIR.mkdir(parents=True, exist_ok=True)

TIER_LETTERS = ["OP", "S+", "S", "A", "B", "C", "D"]
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_tierlist(html):
    """Walk tier-list DOM in order; tag each comp card with the most recently
    seen tier header. Same comp appears multiple times with different tiers —
    we collect all placements so callers can rank conditional tiers."""
    soup = BeautifulSoup(html, "html.parser")
    current_tier = None
    placements = {}
    seen = set()

    for node in soup.descendants:
        if not hasattr(node, "get"):
            continue
        cls = " ".join(node.get("class", []) or [])

        if any(k in cls for k in ("tier-header", "tier-row", "tier-list-label")):
            if node.name in ("h2", "h3", "h4", "div", "span"):
                txt = node.get_text(" ", strip=True)
                for tier in TIER_LETTERS:
                    if txt == tier or txt == tier + " tier" or txt.startswith(tier + " "):
                        current_tier = tier
                        break

        if "comp-card-wrapper" in cls and id(node) not in seen:
            seen.add(id(node))
            name_el = node.select_one(".tier-comp-name")
            link_el = node.select_one('a[href*="/composition/"]')
            if not name_el or not link_el:
                continue
            name = name_el.get_text(" ", strip=True)
            if not name or name == "Comp Name":
                continue
            href = link_el.get("href") or ""
            if not href:
                continue
            slug = href.rstrip("/").rsplit("/", 1)[-1]

            inner = node.select_one(".comp-card") or node
            econ = None
            for c in (inner.get("class", []) or []):
                if c.startswith("comp-card--"):
                    econ = c.replace("comp-card--", "")
                    break

            entry = placements.setdefault(
                slug,
                {
                    "slug": slug,
                    "name": name,
                    "url": href,
                    "econ": econ,
                    "tiers": [],
                },
            )
            if current_tier and current_tier not in entry["tiers"]:
                entry["tiers"].append(current_tier)

    return placements


def parse_comp_page(html):
    """Extract structured fields from a /composition/set17/<slug> page."""
    soup = BeautifulSoup(html, "html.parser")

    def meta(prop):
        el = soup.select_one(f'meta[property="{prop}"]') or soup.select_one(
            f'meta[name="{prop}"]'
        )
        return (el.get("content") or "").strip() if el else ""

    title = meta("og:title") or (soup.title.get_text(strip=True) if soup.title else "")
    title = re.sub(r"\s*\[Set \d+\].*$", "", title)
    title = re.sub(r"\s*Comp Guide.*$", "", title).strip()

    desc = meta("og:description")

    # Dedup by apiName but OR the carry flag across all occurrences -- tftflow
    # renders the same unit in multiple builds (main / alt / flex) and only some
    # occurrences carry the carry-badge class.
    board_order = []
    units_by_api = {}
    for el in soup.select(".hex-content-group--static .champion-name.champion-icon"):
        api = el.get("data-champion-apiname") or ""
        if not api:
            continue
        classes = " ".join(el.get("class", []) or [])
        name = el.get_text(" ", strip=True)
        is_carry = "champion-name--carry" in classes

        cost = None
        parent = el
        for _ in range(6):
            if parent is None:
                break
            parent = parent.parent
            if parent is None:
                break
            for c in (parent.get("class", []) or []):
                m = re.match(r"champion-tooltip--cost(\d)", c)
                if m:
                    cost = int(m.group(1))
                    break
                m = re.match(r"builder-champion--cost(\d)", c)
                if m:
                    cost = int(m.group(1))
                    break
            if cost is not None:
                break

        if api not in units_by_api:
            units_by_api[api] = {
                "apiName": api,
                "name": name,
                "cost": cost,
                "carry": is_carry,
            }
            board_order.append(api)
        else:
            u = units_by_api[api]
            u["carry"] = u["carry"] or is_carry
            if cost is not None and u.get("cost") is None:
                u["cost"] = cost

    board = [units_by_api[a] for a in board_order]
    carries = [u["apiName"] for u in board if u["carry"]]

    augments = []
    aug_seen = set()
    for a in soup.select(".augment-icon"):
        t = (
            a.get("title")
            or a.get("alt")
            or a.get("data-augment-name")
            or ""
        ).strip()
        if not t:
            parent = a.parent
            if parent:
                t = (parent.get("title") or "").strip()
        if not t or t in aug_seen:
            continue
        aug_seen.add(t)
        augments.append(t)

    patch = ""
    patch_el = soup.find(string=re.compile(r"Patch\s+17\.\d+"))
    if patch_el:
        m = re.search(r"Patch\s+17\.\d+[a-z]?", patch_el)
        if m:
            patch = m.group(0)

    return {
        "title": title,
        "og_desc": desc,
        "board": board,
        "carries": carries,
        "augments": augments,
        "patch": patch,
    }


def main():
    print("Fetching tftflow tier list...")
    tierlist_html = fetch("https://tftflow.com/tier-list")
    placements = parse_tierlist(tierlist_html)
    print(f"  Found {len(placements)} unique comps with tier placements")

    comps = []
    for i, (slug, base) in enumerate(placements.items()):
        url = base["url"]
        print(f"  [{i+1}/{len(placements)}] {slug} ...", end=" ", flush=True)
        try:
            html = fetch(url)
            detail = parse_comp_page(html)
        except Exception as exc:
            print(f"FAIL: {exc}")
            continue

        merged = dict(base)
        merged.update(detail)
        # Prefer tftflow's own page title over tier list name if set
        if detail.get("title"):
            merged["name"] = detail["title"]
        comps.append(merged)
        print(
            f"board={len(detail['board'])} carries={len(detail['carries'])} "
            f"aug={len(detail['augments'])} patch={detail['patch']!r}"
        )
        time.sleep(0.4)  # be polite

    out_path = OUT_DIR / "tftflow_set17.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(comps, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {out_path} ({len(comps)} comps)")


if __name__ == "__main__":
    main()
