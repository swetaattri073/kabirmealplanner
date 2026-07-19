"""
Recipe library for LittleBowl.

Includes curated toddler recipes plus one recipe card per food in the Indian
food database (using toddler_friendly_version + preparation_tips).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from food_database import INDIAN_FOODS

CURATED_RECIPES = [
    {
        "name": "Paneer Pasta",
        "food_names": ["Paneer Pasta", "Pasta"],
        "category": "combo",
        "why": "Pasta is already an easy nutrition carrier for many toddlers.",
        "cheese": "Use a cheese cube or skip it — paneer is the main protein here.",
        "steps": "Blend paneer + milk + tiny boiled pumpkin/carrot + butter. Mix with pasta. Keep sauce light in color.",
    },
    {
        "name": "Cheese Corn Paratha",
        "food_names": ["Cheese Corn Paratha", "Paratha (Plain)", "Aloo Paratha"],
        "category": "grain",
        "why": "Similar to paneer paratha — mild and familiar.",
        "cheese": "Use a cheese slice or grated mozzarella. Avoid too much processed cheese daily.",
        "steps": "Mash boiled corn + potato + cheese. Stuff lightly in paratha. Serve with curd.",
    },
    {
        "name": "Curd Rice Balls",
        "food_names": ["Curd Rice", "Rice (Cooked)"],
        "category": "combo",
        "why": "Uses common safe foods: white rice, curd, ghee, in a finger-food format.",
        "cheese": "No cheese needed.",
        "steps": "Mix cold rice + curd + ghee. Make small balls. Keep them plain; avoid mixing in colored dal/sabji.",
    },
    {
        "name": "Mini Pizza Toast",
        "food_names": ["Vegetable Sandwich", "Cheese Toast Fingers"],
        "category": "snack",
        "why": "Fun format that can hide a little veggie sauce.",
        "cheese": "Use mozzarella or a grated cheese cube. Keep the layer thin.",
        "steps": "Bread + very light hidden pumpkin/carrot sauce + cheese. Toast and cut into fingers.",
    },
    {
        "name": "Paneer Dosa",
        "food_names": ["Dosa (Plain)", "Dosa with Coconut Chutney"],
        "category": "grain",
        "why": "Close to the idli/dosa family many toddlers already accept.",
        "cheese": "Optional cheese spread — paneer mash is enough.",
        "steps": "Make a plain dosa. Add paneer mash + ghee. Fold and cut into strips.",
    },
    {
        "name": "Ragi Banana Pancake",
        "food_names": ["Ragi/Finger Millet Porridge", "Ragi Porridge"],
        "category": "grain",
        "why": "Similar to a regular pancake, but adds iron.",
        "cheese": "No cheese needed.",
        "steps": "Mix banana + ragi flour + milk/egg + nut powder. Cook small pancakes in ghee.",
    },
    {
        "name": "Cheese Toast Fingers",
        "food_names": ["Cheese Toast Fingers"],
        "category": "snack",
        "why": "Good snack when a dry, predictable texture is wanted.",
        "cheese": "Use a cheese slice for easiest melting, or grated cheese cube.",
        "steps": "Toast bread with a thin cheese layer. Cut into long fingers. Offer cucumber on the side.",
    },
    {
        "name": "Stuffed Idli",
        "food_names": ["Idli", "Idli with Sambar"],
        "category": "grain",
        "why": "Uses an accepted idli format with hidden protein.",
        "cheese": "Optional tiny grated cheese cube — paneer stuffing works better nutritionally.",
        "steps": "Add idli batter, then a tiny paneer mash, then batter again. Steam as usual.",
    },
    {
        "name": "Soft Chicken Strips",
        "food_names": ["Chicken (Boneless)"],
        "category": "protein",
        "why": "Mild animal protein that fits non-veg preferences.",
        "cheese": "No cheese needed.",
        "steps": "Pressure-cook or steam boneless chicken until soft. Shred into thin strips. Serve with rice or soft roti and a mild gravy.",
    },
    {
        "name": "Mild Fish Mash",
        "food_names": ["Fish (Rohu/Pomfret)"],
        "category": "protein",
        "why": "Soft fish is a good iron and protein option when bones are carefully removed.",
        "cheese": "No cheese needed.",
        "steps": "Steam boneless fish fillet. Flake carefully and check for bones. Mash with a little ghee or curd. Serve with soft rice.",
    },
    {
        "name": "Soft Boiled Egg",
        "food_names": ["Egg (Boiled)", "Egg Bhurji", "Omelette", "Egg Curry"],
        "category": "protein",
        "why": "Simple protein for eggetarian and non-veg plans.",
        "cheese": "No cheese needed.",
        "steps": "Boil egg until yolk is firm. Mash with a drop of ghee. For bhurji/omelette, keep spices very mild and cook through.",
    },
]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug or "recipe"


def slugify_recipe_name(name: str) -> str:
    return _slugify(name)


def detect_video_platform(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    u = url.strip().lower()
    if not u:
        return None
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "instagram.com" in u:
        return "instagram"
    return "other"


def youtube_embed_url(url: Optional[str]) -> Optional[str]:
    """Convert a YouTube watch/share URL into an embeddable /embed/ URL."""
    if not url:
        return None
    u = url.strip()
    # youtu.be/<id>
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{6,})", u)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}"
    # youtube.com/watch?v=<id>
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", u)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}"
    # youtube.com/embed/<id> or /shorts/<id>
    m = re.search(r"youtube\.com/(?:embed|shorts)/([A-Za-z0-9_-]{6,})", u)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}"
    return None


def _food_to_recipe(food: Dict[str, Any]) -> Dict[str, Any]:
    name = food.get("name") or "Food"
    why = food.get("toddler_friendly_version") or f"Age-appropriate {food.get('category', 'meal')} option for toddlers."
    tips = food.get("preparation_tips") or "Cook until soft and supervise while eating."
    steps = f"{why} {tips}".strip()
    return {
        "id": _slugify(name),
        "slug": _slugify(name),
        "name": name,
        "food_names": [name],
        "category": food.get("category") or "combo",
        "why": why,
        "cheese": "",
        "steps": steps,
        "source": "food_db",
        "allergens": food.get("allergens") or [],
        "suitable_from_months": food.get("suitable_from_months"),
        "cover_image_path": None,
        "video_url": None,
        "video_platform": None,
        "video_embed_url": None,
    }


def _curated_to_recipe(item: Dict[str, Any]) -> Dict[str, Any]:
    name = item["name"]
    return {
        "id": _slugify(name),
        "slug": _slugify(name),
        "name": name,
        "food_names": item.get("food_names") or [name],
        "category": item.get("category") or "combo",
        "why": item.get("why") or "",
        "cheese": item.get("cheese") or "",
        "steps": item.get("steps") or "",
        "source": "curated",
        "allergens": [],
        "suitable_from_months": None,
        "cover_image_path": None,
        "video_url": None,
        "video_platform": None,
        "video_embed_url": None,
    }


def _enrich_video_fields(recipe: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(recipe)
    platform = out.get("video_platform") or detect_video_platform(out.get("video_url"))
    out["video_platform"] = platform
    out["video_embed_url"] = youtube_embed_url(out.get("video_url")) if platform == "youtube" else None
    return out


def _load_db_recipes(published_only: bool = True) -> List[Dict[str, Any]]:
    try:
        from models import Recipe
        q = Recipe.query
        if published_only:
            q = q.filter_by(is_published=True)
        rows = q.order_by(Recipe.sort_order.desc(), Recipe.created_at.desc()).all()
        return [_enrich_video_fields(r.to_public_dict()) for r in rows]
    except Exception:
        return []


def _merged_recipes(published_only: bool = True) -> List[Dict[str, Any]]:
    """Admin DB recipes first (override same slug), then static curated/food cards."""
    by_slug: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    for recipe in _load_db_recipes(published_only=published_only):
        slug = recipe["slug"]
        if slug not in by_slug:
            order.append(slug)
        by_slug[slug] = recipe

    for recipe in _ALL_RECIPES:
        slug = recipe["slug"]
        if slug in by_slug:
            # Merge food_names onto admin/static winner
            names = set(by_slug[slug].get("food_names") or [])
            names.update(recipe.get("food_names") or [])
            by_slug[slug]["food_names"] = sorted(names)
            continue
        by_slug[slug] = _enrich_video_fields(recipe)
        order.append(slug)

    return [by_slug[s] for s in order]


def _build_all_recipes() -> List[Dict[str, Any]]:
    recipes: List[Dict[str, Any]] = []
    seen = set()

    for item in CURATED_RECIPES:
        recipe = _curated_to_recipe(item)
        if recipe["slug"] not in seen:
            recipes.append(recipe)
            seen.add(recipe["slug"])

    for food in INDIAN_FOODS:
        recipe = _food_to_recipe(food)
        if recipe["slug"] in seen:
            for existing in recipes:
                if existing["slug"] == recipe["slug"]:
                    names = set(existing.get("food_names") or [])
                    names.update(recipe.get("food_names") or [])
                    existing["food_names"] = sorted(names)
                    break
            continue
        recipes.append(recipe)
        seen.add(recipe["slug"])

    return recipes


_ALL_RECIPES = _build_all_recipes()
_BY_SLUG = {r["slug"]: r for r in _ALL_RECIPES}


def list_recipes(category: Optional[str] = None, q: Optional[str] = None) -> List[Dict[str, Any]]:
    recipes = _merged_recipes(published_only=True)
    if category:
        recipes = [r for r in recipes if (r.get("category") or "") == category]
    if q:
        needle = q.strip().lower()
        recipes = [
            r for r in recipes
            if needle in r["name"].lower()
            or any(needle in n.lower() for n in (r.get("food_names") or []))
            or needle in (r.get("steps") or "").lower()
        ]
    return recipes


def get_recipe(slug: str) -> Optional[Dict[str, Any]]:
    key = (slug or "").strip().lower()
    for recipe in _merged_recipes(published_only=True):
        if recipe.get("slug") == key:
            return recipe
    return _enrich_video_fields(_BY_SLUG[key]) if key in _BY_SLUG else None


def find_recipe_for_food_name(food_name: Optional[str]) -> Optional[Dict[str, Any]]:
    if not food_name:
        return None
    name = food_name.strip().lower()
    if not name:
        return None

    recipes = _merged_recipes(published_only=True)

    for recipe in recipes:
        for n in recipe.get("food_names") or []:
            if n.lower() == name:
                return recipe

    for recipe in recipes:
        if recipe["name"].lower() == name:
            return recipe

    for recipe in recipes:
        for n in recipe.get("food_names") or [recipe["name"]]:
            nl = n.lower()
            if name in nl or nl in name:
                return recipe

    words = [w for w in re.split(r"\s+", name) if len(w) > 2]
    if not words:
        return None
    best = None
    best_score = 0
    for recipe in recipes:
        hay = " ".join(recipe.get("food_names") or [recipe["name"]]).lower()
        score = sum(1 for w in words if w in hay)
        if score > best_score:
            best_score = score
            best = recipe
    return best if best_score > 0 else None


def recipe_slug_for_food_name(food_name: Optional[str]) -> Optional[str]:
    recipe = find_recipe_for_food_name(food_name)
    return recipe["slug"] if recipe else None
