"""
Background nutrient lookup for user-added foods.

Primary source: Open Food Facts (no API key).
Fallback: category-based estimates so nutrition stats still update.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

USER_AGENT = "KabirMealPlanner/1.0 (toddler meal planner; github.com/swetaattri073/kabirmealplanner)"

# Rough per-100g estimates when external lookup fails (Indian toddler-oriented)
CATEGORY_ESTIMATES: Dict[str, Dict[str, float]] = {
    "grain": {
        "calories": 130, "protein_g": 3.5, "carbs_g": 28, "fat_g": 1.0, "fiber_g": 1.5,
        "calcium_mg": 15, "iron_mg": 1.2, "zinc_mg": 0.8,
        "vitamin_a_mcg": 0, "vitamin_c_mg": 0, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0, "folate_mcg": 20,
    },
    "dal": {
        "calories": 110, "protein_g": 7.0, "carbs_g": 18, "fat_g": 1.5, "fiber_g": 4.0,
        "calcium_mg": 30, "iron_mg": 2.5, "zinc_mg": 1.2,
        "vitamin_a_mcg": 10, "vitamin_c_mg": 1, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0, "folate_mcg": 60,
    },
    "vegetable": {
        "calories": 45, "protein_g": 2.0, "carbs_g": 8, "fat_g": 0.5, "fiber_g": 2.5,
        "calcium_mg": 40, "iron_mg": 1.0, "zinc_mg": 0.4,
        "vitamin_a_mcg": 200, "vitamin_c_mg": 20, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0, "folate_mcg": 40,
    },
    "fruit": {
        "calories": 60, "protein_g": 0.8, "carbs_g": 14, "fat_g": 0.2, "fiber_g": 2.0,
        "calcium_mg": 15, "iron_mg": 0.3, "zinc_mg": 0.1,
        "vitamin_a_mcg": 30, "vitamin_c_mg": 25, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0, "folate_mcg": 15,
    },
    "dairy": {
        "calories": 90, "protein_g": 4.5, "carbs_g": 6, "fat_g": 5.0, "fiber_g": 0,
        "calcium_mg": 150, "iron_mg": 0.1, "zinc_mg": 0.5,
        "vitamin_a_mcg": 40, "vitamin_c_mg": 1, "vitamin_d_mcg": 0.5,
        "vitamin_b12_mcg": 0.5, "folate_mcg": 10,
    },
    "protein": {
        "calories": 150, "protein_g": 15, "carbs_g": 2, "fat_g": 9.0, "fiber_g": 0,
        "calcium_mg": 20, "iron_mg": 1.5, "zinc_mg": 2.0,
        "vitamin_a_mcg": 20, "vitamin_c_mg": 0, "vitamin_d_mcg": 0.5,
        "vitamin_b12_mcg": 1.0, "folate_mcg": 15,
    },
    "snack": {
        "calories": 120, "protein_g": 3.0, "carbs_g": 18, "fat_g": 4.0, "fiber_g": 1.5,
        "calcium_mg": 25, "iron_mg": 0.8, "zinc_mg": 0.5,
        "vitamin_a_mcg": 10, "vitamin_c_mg": 2, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0, "folate_mcg": 15,
    },
    "beverage": {
        "calories": 40, "protein_g": 1.0, "carbs_g": 8, "fat_g": 0.5, "fiber_g": 0,
        "calcium_mg": 40, "iron_mg": 0.1, "zinc_mg": 0.1,
        "vitamin_a_mcg": 5, "vitamin_c_mg": 5, "vitamin_d_mcg": 0,
        "vitamin_b12_mcg": 0.1, "folate_mcg": 5,
    },
    "combo": {
        "calories": 120, "protein_g": 5.0, "carbs_g": 18, "fat_g": 3.0, "fiber_g": 2.5,
        "calcium_mg": 40, "iron_mg": 1.5, "zinc_mg": 0.8,
        "vitamin_a_mcg": 80, "vitamin_c_mg": 8, "vitamin_d_mcg": 0.1,
        "vitamin_b12_mcg": 0.2, "folate_mcg": 30,
    },
}

CATEGORY_KEYWORDS = {
    "dal": ["dal", "daal", "sambar", "rasam", "chole", "rajma", "lobia", "lentil", "pulse"],
    "fruit": ["banana", "apple", "mango", "orange", "papaya", "guava", "grape", "berry", "fruit"],
    "dairy": ["milk", "curd", "yogurt", "dahi", "paneer", "cheese", "butter", "ghee", "lassi"],
    "vegetable": ["sabzi", "vegetable", "aloo", "gobi", "palak", "spinach", "carrot", "beans", "cucumber", "tomato", "bhindi"],
    "grain": ["rice", "roti", "chapati", "paratha", "thepla", "bread", "poha", "upma", "idli", "dosa", "oats", "dalia", "khichdi", "puri", "naan"],
    "protein": ["egg", "anda", "chicken", "fish", "meat", "mutton", "tofu"],
    "beverage": ["juice", "smoothie", "shake", "water", "tea", "coffee"],
    "combo": ["thali", "meal", "with"],
    "snack": ["snack", "biscuit", "cookie", "chips", "namkeen", "murukku"],
}


def guess_category(name: str, fallback: str = "snack") -> str:
    """Guess a food category from the name."""
    text = (name or "").lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(k in text for k in keywords):
            return category
    return fallback if fallback in CATEGORY_ESTIMATES else "snack"


def _num(nutriments: dict, *keys: str) -> Optional[float]:
    for key in keys:
        val = nutriments.get(key)
        if val is None:
            continue
        try:
            return float(val)
        except (TypeError, ValueError):
            continue
    return None


def _from_off_product(product: dict) -> Optional[Dict[str, Any]]:
    nutriments = product.get("nutriments") or {}
    calories = _num(nutriments, "energy-kcal_100g", "energy-kcal")
    # Sometimes only kJ is present
    if calories is None:
        kj = _num(nutriments, "energy-kj_100g", "energy_100g")
        if kj is not None:
            calories = kj / 4.184

    protein = _num(nutriments, "proteins_100g")
    carbs = _num(nutriments, "carbohydrates_100g")
    fat = _num(nutriments, "fat_100g")

    # Need at least calories or macros to be useful
    if calories is None and protein is None and carbs is None and fat is None:
        return None

    return {
        "calories": calories or 0,
        "protein_g": protein or 0,
        "carbs_g": carbs or 0,
        "fat_g": fat or 0,
        "fiber_g": _num(nutriments, "fiber_100g") or 0,
        "calcium_mg": _num(nutriments, "calcium_100g") or 0,
        "iron_mg": _num(nutriments, "iron_100g") or 0,
        "zinc_mg": _num(nutriments, "zinc_100g") or 0,
        "vitamin_a_mcg": _num(nutriments, "vitamin-a_100g") or 0,
        "vitamin_c_mg": _num(nutriments, "vitamin-c_100g") or 0,
        "vitamin_d_mcg": _num(nutriments, "vitamin-d_100g") or 0,
        "vitamin_b12_mcg": _num(nutriments, "vitamin-b12_100g") or 0,
        "folate_mcg": _num(nutriments, "folates_100g", "vitamin-b9_100g") or 0,
        "matched_name": product.get("product_name") or product.get("generic_name"),
        "source": "openfoodfacts",
    }


def lookup_open_food_facts(food_name: str, timeout: float = 8.0) -> Optional[Dict[str, Any]]:
    """Search Open Food Facts by name; return per-100g nutrients or None."""
    query = re.sub(r"\s+", " ", (food_name or "").strip())
    if len(query) < 2:
        return None

    try:
        resp = requests.get(
            "https://world.openfoodfacts.org/cgi/search.pl",
            params={
                "search_terms": query,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": 8,
                "fields": "product_name,generic_name,nutriments,countries_tags,completeness",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Open Food Facts lookup failed for %r: %s", food_name, exc)
        return None

    products = data.get("products") or []
    query_l = query.lower()
    scored = []
    for p in products:
        name = (p.get("product_name") or p.get("generic_name") or "").lower()
        if not name:
            continue
        score = 0
        if query_l == name:
            score += 100
        elif query_l in name or name in query_l:
            score += 50
        else:
            overlap = len(set(query_l.split()) & set(name.split()))
            score += overlap * 10
        completeness = p.get("completeness") or 0
        try:
            score += float(completeness) * 5
        except (TypeError, ValueError):
            pass
        nutrients = _from_off_product(p)
        if nutrients:
            scored.append((score, nutrients))

    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def estimate_by_category(category: str) -> Dict[str, Any]:
    base = CATEGORY_ESTIMATES.get(category) or CATEGORY_ESTIMATES["snack"]
    result = dict(base)
    result["source"] = "category_estimate"
    result["matched_name"] = None
    return result


def lookup_nutrients(food_name: str, category: Optional[str] = None) -> Dict[str, Any]:
    """
    Resolve nutrients for a food name.
    Tries Open Food Facts first, then category estimates.
    """
    cat = category or guess_category(food_name)
    off = lookup_open_food_facts(food_name)
    if off:
        off["category_used"] = cat
        return off
    est = estimate_by_category(cat)
    est["category_used"] = cat
    return est
