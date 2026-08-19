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
        "cover_image_url": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
    },
    {
        "name": "Cheese Corn Paratha",
        "food_names": ["Cheese Corn Paratha", "Paratha (Plain)", "Aloo Paratha"],
        "category": "grain",
        "why": "Similar to paneer paratha — mild and familiar.",
        "cheese": "Use a cheese slice or grated mozzarella. Avoid too much processed cheese daily.",
        "steps": "Mash boiled corn + potato + cheese. Stuff lightly in paratha. Serve with curd.",
        "cover_image_url": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
    },
    {
        "name": "Curd Rice Balls",
        "food_names": ["Curd Rice", "Rice (Cooked)"],
        "category": "combo",
        "why": "Uses common safe foods: white rice, curd, ghee, in a finger-food format.",
        "cheese": "No cheese needed.",
        "steps": "Mix cold rice + curd + ghee. Make small balls. Keep them plain; avoid mixing in colored dal/sabji.",
        "cover_image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop",
    },
    {
        "name": "Mini Pizza Toast",
        "food_names": ["Vegetable Sandwich", "Cheese Toast Fingers"],
        "category": "snack",
        "why": "Fun format that can hide a little veggie sauce.",
        "cheese": "Use mozzarella or a grated cheese cube. Keep the layer thin.",
        "steps": "Bread + very light hidden pumpkin/carrot sauce + cheese. Toast and cut into fingers.",
        "cover_image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop",
    },
    {
        "name": "Paneer Dosa",
        "food_names": ["Dosa (Plain)", "Dosa with Coconut Chutney"],
        "category": "grain",
        "why": "Close to the idli/dosa family many toddlers already accept.",
        "cheese": "Optional cheese spread — paneer mash is enough.",
        "steps": "Make a plain dosa. Add paneer mash + ghee. Fold and cut into strips.",
        "cover_image_url": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    },
    {
        "name": "Ragi Banana Pancake",
        "food_names": ["Ragi/Finger Millet Porridge", "Ragi Porridge"],
        "category": "grain",
        "why": "Similar to a regular pancake, but adds iron.",
        "cheese": "No cheese needed.",
        "steps": "Mix banana + ragi flour + milk/egg + nut powder. Cook small pancakes in ghee.",
        "cover_image_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    },
    {
        "name": "Cheese Toast Fingers",
        "food_names": ["Cheese Toast Fingers"],
        "category": "snack",
        "why": "Good snack when a dry, predictable texture is wanted.",
        "cheese": "Use a cheese slice for easiest melting, or grated cheese cube.",
        "steps": "Toast bread with a thin cheese layer. Cut into long fingers. Offer cucumber on the side.",
        "cover_image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop",
    },
    {
        "name": "Stuffed Idli",
        "food_names": ["Idli", "Idli with Sambar"],
        "category": "grain",
        "why": "Uses an accepted idli format with hidden protein.",
        "cheese": "Optional tiny grated cheese cube — paneer stuffing works better nutritionally.",
        "steps": "Add idli batter, then a tiny paneer mash, then batter again. Steam as usual.",
        "cover_image_url": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop",
    },
    {
        "name": "Soft Chicken Strips",
        "food_names": ["Chicken (Boneless)"],
        "category": "protein",
        "why": "Mild animal protein that fits non-veg preferences.",
        "cheese": "No cheese needed.",
        "steps": "Pressure-cook or steam boneless chicken until soft. Shred into thin strips. Serve with rice or soft roti and a mild gravy.",
        "cover_image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
    },
    {
        "name": "Mild Fish Mash",
        "food_names": ["Fish (Rohu/Pomfret)"],
        "category": "protein",
        "why": "Soft fish is a good iron and protein option when bones are carefully removed.",
        "cheese": "No cheese needed.",
        "steps": "Steam boneless fish fillet. Flake carefully and check for bones. Mash with a little ghee or curd. Serve with soft rice.",
        "cover_image_url": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
    },
    {
        "name": "Soft Boiled Egg",
        "food_names": ["Egg (Boiled)", "Egg Bhurji", "Omelette", "Egg Curry"],
        "category": "protein",
        "why": "Simple protein for eggetarian and non-veg plans.",
        "cheese": "No cheese needed.",
        "steps": "Boil egg until yolk is firm. Mash with a drop of ghee. For bhurji/omelette, keep spices very mild and cook through.",
        "cover_image_url": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop",
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


FOOD_COVER_IMAGES: Dict[str, str] = {
    "Rice (Cooked)": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&h=300&fit=crop",
    "Roti/Chapati": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
    "Idli": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop",
    "Dosa (Plain)": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    "Upma": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Poha": "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400&h=300&fit=crop",
    "Khichdi": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop",
    "Oats Porridge": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&h=300&fit=crop",
    "Moong Dal": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop",
    "Sambar": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    "Rajma (Kidney Beans)": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
    "Chole/Chickpeas": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
    "Potato (Boiled/Mashed)": "https://images.unsplash.com/photo-1518977676601-b53f82ber33?w=400&h=300&fit=crop",
    "Sweet Potato": "https://images.unsplash.com/photo-1596097635092-6d8498d94bac?w=400&h=300&fit=crop",
    "Carrot": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop",
    "Spinach/Palak": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=300&fit=crop",
    "Pumpkin": "https://images.unsplash.com/photo-1509622905150-fa66d3906e09?w=400&h=300&fit=crop",
    "Banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop",
    "Apple": "https://images.unsplash.com/photo-1584306820500-2d37e1e23e57?w=400&h=300&fit=crop",
    "Mango": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop",
    "Papaya": "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=400&h=300&fit=crop",
    "Milk (Whole)": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=300&fit=crop",
    "Curd/Yogurt": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",
    "Paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
    "Ghee": "https://images.unsplash.com/photo-1600398089688-e9aaf5e37c99?w=400&h=300&fit=crop",
    "Egg (Boiled)": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop",
    "Dal Rice": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop",
    "Vegetable Pulao": "https://images.unsplash.com/photo-1596097635092-6d8498d94bac?w=400&h=300&fit=crop",
    "Palak Paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
    "Aloo Paratha": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
    "Curd Rice": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop",
    "Uttapam": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    "Besan Chilla": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Suji Halwa": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "Banana Pancakes": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "Idli with Sambar": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop",
    "Moong Dal Cheela": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Ragi Dosa": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    "Mixed Vegetable Sabzi": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
    "Egg Bhurji": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop",
    "Pongal": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop",
    "Coconut Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&h=300&fit=crop",
    "Tomato Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&h=300&fit=crop",
    "Rava Upma with Vegetables": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Vegetable Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
    "Fruit Chaat": "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=300&fit=crop",
    "Dry Fruits Mix (soaked)": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
    "Makhana": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
    "Carrot Halwa": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "Rice Kheer": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "Paneer Bhurji": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
    "Ragi Mudde": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Peas Pulao": "https://images.unsplash.com/photo-1596097635092-6d8498d94bac?w=400&h=300&fit=crop",
    "Til Ladoo": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
    "Foxtail Millet Upma": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop",
    "Daliya/Broken Wheat Porridge": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&h=300&fit=crop",
    "Paratha (Plain)": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
    "Dosa with Coconut Chutney": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop",
    "French Toast": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&h=300&fit=crop",
    "Vegetable Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop",
    "Omelette": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=300&fit=crop",
    "Egg Curry": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
    "Chicken (Boneless)": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
    "Fish (Rohu/Pomfret)": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
}


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
        "cover_image_path": FOOD_COVER_IMAGES.get(name),
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
        "cover_image_path": item.get("cover_image_url") or None,
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
