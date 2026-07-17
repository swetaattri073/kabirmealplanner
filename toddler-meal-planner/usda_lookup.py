"""
Optional USDA FoodData Central lookups — ported from the React nutrition proxy.

Falls back gracefully when USDA_FDC_API_KEY is unset (uses DEMO_KEY with low limits).
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

import requests
from urllib.parse import quote

FDC_BASE = "https://api.nal.usda.gov/fdc/v1"
_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL = 60 * 60 * 12


def _api_key() -> str:
    return os.environ.get("USDA_FDC_API_KEY") or "DEMO_KEY"


def using_demo_key() -> bool:
    return _api_key() == "DEMO_KEY"


def _cached_get(cache_key: str, url: str) -> Dict[str, Any]:
    hit = _CACHE.get(cache_key)
    if hit and time.time() - hit["at"] < _CACHE_TTL:
        return hit["data"]
    res = requests.get(url, timeout=30)
    if not res.ok:
        raise RuntimeError(f"USDA API {res.status_code}: {res.text[:200]}")
    data = res.json()
    _CACHE[cache_key] = {"data": data, "at": time.time()}
    return data


NUTRIENT_MAP = {
    1008: "calories",
    1003: "protein_g",
    1005: "carbs_g",
    1004: "fat_g",
    1079: "fiber_g",
    1087: "calcium_mg",
    1089: "iron_mg",
    1095: "zinc_mg",
    1106: "vitamin_a_mcg",
    1162: "vitamin_c_mg",
    1114: "vitamin_d_mcg",
}


def normalize_nutrients(food_detail: Dict[str, Any]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for n in food_detail.get("foodNutrients") or []:
        nutrient = n.get("nutrient") or {}
        nid = nutrient.get("id") or n.get("nutrientId")
        amount = n.get("amount")
        if amount is None:
            amount = n.get("value")
        key = NUTRIENT_MAP.get(nid)
        if key and amount is not None:
            out[key] = round(float(amount), 2)
    return out


def search_foods(query: str, page_size: int = 10) -> Dict[str, Any]:
    key = _api_key()
    url = (
        f"{FDC_BASE}/foods/search?api_key={key}&pageSize={page_size}"
        f"&dataType=Foundation,SR Legacy,Survey (FNDDS)&query={quote(query)}"
    )
    data = _cached_get(f"search:{query.lower()}", url)
    foods = data.get("foods") or []
    candidates = [
        {"fdcId": f.get("fdcId"), "description": f.get("description"), "dataType": f.get("dataType")}
        for f in foods
    ]
    best = foods[0] if foods else None
    return {
        "query": query,
        "candidates": candidates,
        "bestMatchFdcId": best.get("fdcId") if best else None,
        "usingDemoKey": using_demo_key(),
    }


def get_food(fdc_id: int) -> Dict[str, Any]:
    key = _api_key()
    url = f"{FDC_BASE}/food/{fdc_id}?api_key={key}"
    data = _cached_get(f"food:{fdc_id}", url)
    return {
        "fdcId": data.get("fdcId"),
        "description": data.get("description"),
        "dataType": data.get("dataType"),
        "per100g": normalize_nutrients(data),
        "usingDemoKey": using_demo_key(),
    }
