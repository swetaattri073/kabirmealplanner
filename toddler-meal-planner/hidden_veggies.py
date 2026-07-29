"""
Shared hidden-veggie suggestions for meal plans, recipes, and log-meal tips.

Parents who set always_hidden_veggies get blend-in ideas that map to real Food rows
so logging can count nutrition.
"""

from __future__ import annotations

# Catalog used by planner, recipes, and log-meal picker.
# db_name matches Food.name in food_database.py when present.
HIDDEN_VEGGIE_CATALOG = [
    {
        'key': 'spinach',
        'label': 'Spinach',
        'name': 'Spinach puree',
        'db_name': 'Spinach/Palak',
        'default_g': 15,
        'benefit': 'Hidden veggies + iron',
        'add_to_default': 'dal, khichdi, or roti dough',
        'keywords': ('dal', 'khichdi', 'roti', 'paratha', 'rice', 'gravy', 'curry', 'paneer'),
        'categories': ('dal', 'combo', 'grain', 'vegetable'),
    },
    {
        'key': 'carrot',
        'label': 'Carrot',
        'name': 'Carrot puree/grated',
        'db_name': 'Carrot',
        'default_g': 15,
        'benefit': 'Hidden veggies + vitamin A',
        'add_to_default': 'dal, raita, porridge, or paratha',
        'keywords': ('dal', 'raita', 'paratha', 'porridge', 'upma', 'idli', 'dosa', 'rice'),
        'categories': ('dal', 'grain', 'combo', 'dairy'),
    },
    {
        'key': 'beetroot',
        'label': 'Beetroot',
        'name': 'Beetroot puree',
        'db_name': 'Beetroot',
        'default_g': 15,
        'benefit': 'Hidden veggies + iron',
        'add_to_default': 'roti dough or dal',
        'keywords': ('roti', 'paratha', 'dal', 'dough', 'batter'),
        'categories': ('grain', 'dal'),
    },
    {
        'key': 'lauki',
        'label': 'Lauki',
        'name': 'Zucchini/lauki puree',
        'db_name': 'Bottle Gourd/Lauki',
        'default_g': 15,
        'benefit': 'Hidden veggies + moisture',
        'add_to_default': 'dal, khichdi, or idli batter',
        'keywords': ('dal', 'khichdi', 'idli', 'dosa', 'batter', 'soup'),
        'categories': ('dal', 'combo', 'grain'),
    },
    {
        'key': 'pumpkin',
        'label': 'Pumpkin',
        'name': 'Pumpkin puree',
        'db_name': 'Pumpkin',
        'default_g': 15,
        'benefit': 'Hidden veggies + vitamin A',
        'add_to_default': 'khichdi, dal, or porridge',
        'keywords': ('khichdi', 'dal', 'porridge', 'oats', 'daliya', 'rice'),
        'categories': ('combo', 'grain', 'dal'),
    },
    {
        'key': 'cauliflower',
        'label': 'Cauliflower',
        'name': 'Cauliflower puree',
        'db_name': 'Cauliflower',
        'default_g': 15,
        'benefit': 'Hidden veggies',
        'add_to_default': 'roti dough or gravy',
        'keywords': ('roti', 'paratha', 'gravy', 'curry', 'sabzi', 'dough'),
        'categories': ('grain', 'vegetable', 'combo'),
    },
    {
        'key': 'methi',
        'label': 'Methi',
        'name': 'Methi leaves (finely chopped)',
        'db_name': None,  # no base Food row — tip only
        'default_g': 10,
        'benefit': 'Hidden greens + fiber',
        'add_to_default': 'roti/paratha dough',
        'keywords': ('roti', 'paratha', 'thepla', 'dough'),
        'categories': ('grain',),
    },
]


def _text_blob(*parts):
    return ' '.join(str(p or '') for p in parts).lower()


def score_veggie_for_context(veggie, *, food_name='', category='', meal_type='', extra=''):
    """Higher score = better match for this dish/recipe."""
    blob = _text_blob(food_name, category, meal_type, extra)
    score = 0
    for kw in veggie.get('keywords') or ():
        if kw in blob:
            score += 3
    cat = (category or '').lower()
    if cat and cat in (veggie.get('categories') or ()):
        score += 2
    if meal_type in ('breakfast', 'mid_morning_snack', 'evening_snack'):
        if veggie['key'] in ('carrot', 'pumpkin', 'lauki'):
            score += 1
    if meal_type in ('lunch', 'dinner'):
        if veggie['key'] in ('spinach', 'lauki', 'beetroot', 'cauliflower'):
            score += 1
    return score


def pick_hidden_veggie_suggestions(
    *,
    food_name='',
    category='',
    meal_type='',
    carb_name='',
    side_name='',
    extra='',
    count=2,
    prefer_keys=None,
):
    """
    Return up to `count` suggestion dicts ready for meal plan add_ins / recipe tips.
    """
    context_extra = f'{carb_name} {side_name} {extra}'
    ranked = []
    for veg in HIDDEN_VEGGIE_CATALOG:
        score = score_veggie_for_context(
            veg,
            food_name=food_name,
            category=category,
            meal_type=meal_type,
            extra=context_extra,
        )
        if prefer_keys and veg['key'] in prefer_keys:
            score += 5
        ranked.append((score, veg))
    ranked.sort(key=lambda x: (-x[0], x[1]['label']))

    # Always return something useful even with weak matches
    chosen = [v for score, v in ranked if score > 0][:count]
    if len(chosen) < count:
        for _, veg in ranked:
            if veg in chosen:
                continue
            chosen.append(veg)
            if len(chosen) >= count:
                break

    suggestions = []
    for veg in chosen:
        add_to = veg['add_to_default']
        # Prefer a concrete dish target when we have one
        target = food_name or carb_name
        if target:
            if any(k in (carb_name or food_name or '').lower() for k in ('roti', 'paratha', 'dough', 'batter')):
                add_to = f'{carb_name or food_name} dough / batter'
            else:
                add_to = f'{target} (blend in)'
        suggestions.append({
            'name': veg['name'],
            'label': veg['label'],
            'add_to': add_to,
            'benefit': veg['benefit'],
            'style': 'hidden_veggies',
            'key': veg['key'],
            'db_name': veg.get('db_name'),
            'default_g': veg.get('default_g', 15),
            'how': f"Mix ~1–2 tbsp {veg['label'].lower()} into {add_to}.",
        })
    return suggestions


def suggestions_for_recipe(recipe, count=2):
    """Hidden-veggie tips tailored to a recipe card."""
    if not recipe:
        return []
    food_names = recipe.get('food_names') or []
    blob = ' '.join(food_names) if isinstance(food_names, list) else str(food_names)
    return pick_hidden_veggie_suggestions(
        food_name=recipe.get('name') or '',
        category=recipe.get('category') or '',
        extra=blob,
        count=count,
    )


def attach_food_ids(suggestions, food_lookup):
    """
    Enrich suggestion dicts with food_id using a name→Food (or id) lookup callable/dict.
    food_lookup: dict {db_name: food_id} or callable(db_name) -> food_id|None
    """
    out = []
    for s in suggestions:
        item = dict(s)
        db_name = item.get('db_name')
        food_id = None
        if db_name:
            if callable(food_lookup):
                food_id = food_lookup(db_name)
            elif isinstance(food_lookup, dict):
                food_id = food_lookup.get(db_name)
        if food_id:
            item['food_id'] = food_id
        out.append(item)
    return out


def catalog_for_picker():
    """Entries that map to real foods (for log-meal chips)."""
    return [
        {
            'db_name': v['db_name'],
            'label': v['label'],
            'default_g': v['default_g'],
        }
        for v in HIDDEN_VEGGIE_CATALOG
        if v.get('db_name')
    ]
