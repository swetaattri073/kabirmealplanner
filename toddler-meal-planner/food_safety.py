"""
Food safety flags for infants/toddlers — ported from the React foodSafety.js rules.

General public-health guidance (AAP/WHO/NHS-style), not a medical assessment
of any one child. Always defer to a pediatrician for individual guidance.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional


def _text_fields(food: Dict[str, Any]) -> str:
    parts = [
        food.get("name") or "",
        food.get("add_note") or food.get("addNote") or "",
        food.get("exposure_goal") or food.get("exposureGoal") or "",
        food.get("preparation_tips") or "",
        food.get("toddler_friendly_version") or "",
    ]
    return " ".join(p for p in parts if p).lower()


def _ingredient_names(food: Dict[str, Any]) -> List[str]:
    ingredients = food.get("ingredients") or []
    names = []
    for item in ingredients:
        if isinstance(item, dict):
            names.append((item.get("name") or "").lower())
        elif isinstance(item, str):
            names.append(item.lower())
    return names


def _has_word(text: str, pattern: str) -> bool:
    return re.search(pattern, text, re.IGNORECASE) is not None


DISH_CONTEXT = re.compile(
    r"\b(khichdi|paratha|cheela|pasta|sauce|soup|porridge|mash|mashed|puree|pureed|"
    r"cooked|steamed|boiled|dal|roti|dosa|pancake|sandwich|toast|curry|idli)\b",
    re.IGNORECASE,
)


def _rule(
    rule_id: str,
    label: str,
    severity: str,
    reason: str,
    recommendation: str,
    alternative: str,
    test: Callable[[Dict[str, Any]], bool],
) -> Dict[str, Any]:
    return {
        "id": rule_id,
        "label": label,
        "severity": severity,
        "reason": reason,
        "recommendation": recommendation,
        "alternative": alternative,
        "test": test,
    }


def _test_honey(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    return _has_word(text, r"\bhoney\b") or any("honey" in n for n in _ingredient_names(food))


def _test_mercury(food: Dict[str, Any]) -> bool:
    pattern = r"\b(shark|swordfish|king mackerel|tilefish|marlin|bigeye tuna|orange roughy)\b"
    text = _text_fields(food)
    return _has_word(text, pattern) or any(re.search(pattern, n, re.I) for n in _ingredient_names(food))


def _test_caffeine(food: Dict[str, Any]) -> bool:
    re_caf = re.compile(r"\b(coffee|energy drink|cola)\b", re.I)
    re_tea = re.compile(r"\btea\b(?!\s?spoon)", re.I)
    text = _text_fields(food)
    if re_caf.search(text) or re_tea.search(text):
        return True
    return any(re_caf.search(n) or re_tea.search(n) for n in _ingredient_names(food))


def _test_unpasteurized(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    if _has_word(text, r"unpasteurized|raw milk"):
        return True
    return any(re.search(r"unpasteurized|raw milk", n, re.I) for n in _ingredient_names(food))


def _test_undercooked(food: Dict[str, Any]) -> bool:
    return _has_word(
        _text_fields(food),
        r"\b(sushi|raw egg|runny egg|undercooked|rare steak|raw meat|raw fish)\b",
    )


def _test_popcorn(food: Dict[str, Any]) -> bool:
    return _has_word(_text_fields(food), r"\bpopcorn\b")


def _test_candy(food: Dict[str, Any]) -> bool:
    return _has_word(_text_fields(food), r"\b(hard candy|chewing gum|cough drop)\b")


def _test_grapes(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    has_food = re.search(r"\b(grapes?|cherry tomato(es)?|cherries)\b", text, re.I)
    already_safe = re.search(r"\b(quarter|quartered|halved|halve|sliced|cut up|mashed|puree)\b", text, re.I)
    return bool(has_food and not already_safe)


def _test_hotdog(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    has_food = re.search(r"\b(hot dog|sausage|frankfurter)\b", text, re.I)
    already_safe = re.search(r"\b(sliced lengthwise|quartered|chopped|diced|small pieces)\b", text, re.I)
    return bool(has_food and not already_safe)


def _test_nuts(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    ingredients = " ".join(_ingredient_names(food))
    combined = f"{text} {ingredients}"
    combined = re.sub(r"mature seeds", "", combined, flags=re.I)
    combined = re.sub(
        r"\b(remove|discard|without|no|not\s+using)\s+(whole\s+|the\s+)?(nuts?|peanuts?|almonds?|cashews?|walnuts?|seeds?)\b",
        "",
        combined,
        flags=re.I,
    )
    combined = re.sub(r"de-?seeded|seedless|nut-?free", "", combined, flags=re.I)
    has_food = re.search(r"\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|seeds?)\b", combined, re.I)
    already_safe = re.search(r"\b(powder|butter|flour|ground|smooth|paste)\b", combined, re.I)
    return bool(has_food and not already_safe)


def _test_pb(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    ingredients = " ".join(_ingredient_names(food))
    has_pb = "peanut butter" in text or "peanut butter" in ingredients
    already_safe = re.search(r"\b(thin|spread thin)\b", text, re.I)
    return bool(has_pb and not already_safe)


def _test_raw_veg(food: Dict[str, Any]) -> bool:
    text = _text_fields(food)
    has_food = re.search(r"\b(carrot|apple|celery|cucumber)\b", text, re.I)
    texture = re.search(r"\b(stick|chunk|raw|slice)\b", text, re.I)
    return bool(has_food and texture and not DISH_CONTEXT.search(text))


def _test_salt_sugar(food: Dict[str, Any]) -> bool:
    return _has_word(_text_fields(food), r"\b(added salt|extra salt|added sugar|extra sugar|sugar syrup)\b")


def _test_cow_milk(food: Dict[str, Any]) -> bool:
    for item in food.get("ingredients") or []:
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or "").lower()
        grams = float(item.get("grams") or 0)
        if re.match(r"^milk\b", name) and grams >= 150:
            return True
    return False


SAFETY_RULES: List[Dict[str, Any]] = [
    _rule(
        "honey", "Honey", "avoid",
        "Honey (raw or cooked into food) can contain bacterial spores that cause infant botulism.",
        "Avoid completely before 12 months. Fine to introduce after their first birthday.",
        "Sweeten with mashed ripe banana, unsweetened stewed apple/pear, or a little date paste instead.",
        _test_honey,
    ),
    _rule(
        "high-mercury-fish", "High-mercury fish", "avoid",
        "This fish is high in mercury, which can affect a young child's developing nervous system.",
        "Avoid for infants/toddlers — choose low-mercury options like salmon, tilapia, or light canned tuna.",
        "Try salmon, tilapia, cod, or light canned tuna instead.",
        _test_mercury,
    ),
    _rule(
        "caffeine", "Caffeine", "avoid",
        "Caffeine isn't recommended for infants or toddlers — it can affect sleep, heart rate, and appetite.",
        "Avoid coffee, tea, cola, and energy drinks for this age group.",
        "Offer water, milk, or a caffeine-free kid-friendly herbal infusion instead.",
        _test_caffeine,
    ),
    _rule(
        "unpasteurized", "Unpasteurized dairy/juice", "avoid",
        "Unpasteurized dairy or juice can carry harmful bacteria that are especially risky for young children.",
        "Use pasteurized versions only.",
        "Use the pasteurized version of the same product.",
        _test_unpasteurized,
    ),
    _rule(
        "undercooked-protein", "Raw or undercooked protein", "avoid",
        "Undercooked eggs, meat, or fish carry a higher food-poisoning risk for young children.",
        "Cook eggs, meat, and fish thoroughly before serving.",
        "Serve the same egg/meat/fish fully cooked through.",
        _test_undercooked,
    ),
    _rule(
        "popcorn", "Popcorn", "avoid",
        "Whole popcorn kernels and unpopped bits are a serious choking hazard for young children.",
        "Avoid popcorn until your child is older (most guidance says around age 4).",
        "Try puffed rice/wheat cereal or soft rice-cake pieces instead.",
        _test_popcorn,
    ),
    _rule(
        "hard-candy-gum", "Hard candy / gum", "avoid",
        "Hard candy and gum are a choking hazard and offer no nutritional benefit at this age.",
        "Avoid for infants/toddlers.",
        "Offer soft mashed fruit or smooth yogurt instead.",
        _test_candy,
    ),
    _rule(
        "whole-grapes-tomatoes", "Whole grapes / cherry tomatoes", "modify",
        "Whole grapes and cherry tomatoes are a top choking hazard.",
        "Always quarter lengthwise (not just in half) before serving.",
        "Serve quartered lengthwise, or swap in soft mashed berries.",
        _test_grapes,
    ),
    _rule(
        "hot-dog-sausage", "Hot dog / sausage rounds", "modify",
        "Hot dogs and sausages sliced into coins are a classic choking hazard shape.",
        "Slice lengthwise into quarters, then into small pieces — never serve as round coins.",
        "Serve sliced lengthwise into thin strips, or swap in soft shredded chicken.",
        _test_hotdog,
    ),
    _rule(
        "whole-nuts-seeds", "Whole nuts / seeds", "modify",
        "Whole nuts and seeds are a choking hazard for young children.",
        "Only offer finely ground, as a smooth nut butter spread thin, or as flour/powder — never whole.",
        "Swap in a thin layer of smooth nut butter or nut powder mixed into food.",
        _test_nuts,
    ),
    _rule(
        "thick-peanut-butter", "Thick peanut butter", "modify",
        "A thick spoonful of peanut butter can stick to the roof of the mouth and cause gagging/choking.",
        "Spread in a very thin layer — never serve by the spoonful.",
        "Spread thinly on toast or fruit slices instead of a spoonful.",
        _test_pb,
    ),
    _rule(
        "raw-hard-veg-fruit", "Firm raw fruit/veg pieces", "modify",
        "Firm raw pieces (carrot, apple, celery, cucumber) are a top choking hazard.",
        "Steam or cook until soft, or cut into long thin matchsticks — always supervise.",
        "Serve steamed soft or cut into thin matchsticks instead of a raw chunk.",
        _test_raw_veg,
    ),
    _rule(
        "added-salt-sugar", "Added salt / sugar", "limit",
        "Guidance recommends no added salt before 12 months and minimal added sugar at this age.",
        "Skip added salt/sugar — let natural flavor from fruit, ghee, or mild spices carry the dish.",
        "Flavor with ghee, mild spices, or naturally sweet fruit instead.",
        _test_salt_sugar,
    ),
    _rule(
        "cow-milk-as-drink", "Cow's milk as a main drink", "limit",
        "Cow's milk as a primary drink isn't recommended before 12 months.",
        "Keep breastmilk/formula as the main drink before 12 months; small amounts in cooking are fine.",
        "Offer breastmilk or formula as the main drink until 12 months.",
        _test_cow_milk,
    ),
]


def check_food_safety(food: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return matched safety warnings for one food dict (name + optional notes/ingredients)."""
    if not food:
        return []
    warnings = []
    for rule in SAFETY_RULES:
        try:
            if rule["test"](food):
                warnings.append({
                    "id": rule["id"],
                    "label": rule["label"],
                    "severity": rule["severity"],
                    "reason": rule["reason"],
                    "recommendation": rule["recommendation"],
                    "alternative": rule["alternative"],
                })
        except Exception:
            continue
    return warnings


def check_foods_safety(foods: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return [{food, warnings}] for foods that have at least one flag."""
    flagged = []
    for food in foods:
        warnings = check_food_safety(food)
        if warnings:
            flagged.append({"food": food, "warnings": warnings})
    return flagged


def safety_rules_for_prompt() -> List[Dict[str, str]]:
    """Rules without callables — safe to serialize into chat prompts."""
    return [
        {
            "id": r["id"],
            "label": r["label"],
            "severity": r["severity"],
            "reason": r["reason"],
            "recommendation": r["recommendation"],
            "alternative": r["alternative"],
        }
        for r in SAFETY_RULES
    ]
