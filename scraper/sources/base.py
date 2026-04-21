"""Shared HTTP + Next.js extraction utilities for meta scrapers."""
from __future__ import annotations

import json
import re
import time
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_html(url: str, timeout: int = 25, retries: int = 2) -> Optional[str]:
    """GET a page and return HTML string, or None on failure. Simple retry + backoff."""
    last: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            if r.status_code == 200:
                return r.text
            if r.status_code in (429, 503):
                time.sleep(2 + attempt * 2)
                continue
            return None
        except requests.RequestException as e:
            last = e
            time.sleep(1 + attempt)
    if last:
        print(f"    fetch_html failed: {url} -- {last}")
    return None


def extract_next_data(html: str) -> Optional[dict[str, Any]]:
    """Pull the __NEXT_DATA__ JSON blob from a Next.js rendered page."""
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        return None
    try:
        return json.loads(tag.string)
    except json.JSONDecodeError:
        return None


def extract_json_script(html: str, pattern: str) -> Optional[dict[str, Any]]:
    """Extract JSON from inline <script> matching a regex pattern."""
    if not html:
        return None
    m = re.search(pattern, html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except (json.JSONDecodeError, IndexError):
        return None


def tier_from_wr(win_rate: float, top4_rate: float) -> str:
    """Derive a tier letter from win/top4 rates when the source exposes only %."""
    if top4_rate >= 0.56 or win_rate >= 0.18:
        return "S"
    if top4_rate >= 0.52:
        return "A"
    if top4_rate >= 0.48:
        return "B"
    return "C"


def safe_float(v: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def safe_pct(v: Any) -> Optional[float]:
    """Coerce a value that may be a fraction or percent into a 0-100 number."""
    f = safe_float(v)
    if f is None:
        return None
    return f * 100 if f <= 1.0 else f
