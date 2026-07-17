"""
Chat assistant prompt + tool definition — ported from React chatAssistant.js.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from food_safety import safety_rules_for_prompt

LOG_FOOD_FEEDBACK_TOOL = {
    "type": "function",
    "function": {
        "name": "log_food_feedback",
        "description": (
            "Records a parent's feedback about a specific food (refused, accepted, tried a little) "
            "or a general note about selective/picky eating, so future meal planning takes it into "
            "account. Call this whenever the parent reports something like \"he doesn't eat carrots\", "
            "\"she loved the pasta\", \"he only ate a bite\", or \"he's being really selective this week\". "
            "Never call this just because a food was mentioned in a question — only when the parent is "
            "reporting an actual outcome or pattern."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "foodName": {
                    "type": "string",
                    "description": (
                        "The closest matching food name from the toddler's food list provided in "
                        "context. Leave empty if this is a general note not tied to one specific food."
                    ),
                },
                "response": {
                    "type": "string",
                    "enum": ["refused", "accepted", "partial", "note_only"],
                    "description": (
                        "refused = won't eat it / dislikes it, accepted = eats it well, "
                        "partial = tries a little / sometimes, note_only = a general observation"
                    ),
                },
                "note": {
                    "type": "string",
                    "description": "A short plain-language summary of what the parent said.",
                },
            },
            "required": ["response", "note"],
        },
    },
}

UPDATE_WEEKLY_PLAN_TOOL = {
    "type": "function",
    "function": {
        "name": "update_weekly_plan",
        "description": (
            "Applies meal recommendations into the toddler's weekly plan in the app. "
            "Call this when the parent asks to implement / add / change / put something on the plan "
            "(e.g. \"add chicken to lunch this week\", \"put that on Thursday dinner\", "
            "\"update the plan with your suggestion\"). "
            "Only future unlogged slots are changed — past days and already-logged meals are never deleted. "
            "Do not call this just for advice; only when the parent wants the app plan updated."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "changes": {
                    "type": "array",
                    "description": "One or more plan updates to apply.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "foodName": {
                                "type": "string",
                                "description": "Food name from the toddler food list / database.",
                            },
                            "mealType": {
                                "type": "string",
                                "description": "breakfast, lunch, dinner, mid_morning_snack, or evening_snack. Optional.",
                            },
                            "day": {
                                "type": "string",
                                "description": "Weekday name like Monday. Optional — if omitted, applies to the next few matching future slots.",
                            },
                            "note": {
                                "type": "string",
                                "description": "Short reason shown on the plan.",
                            },
                        },
                        "required": ["foodName"],
                    },
                }
            },
            "required": ["changes"],
        },
    },
}

CHAT_TOOLS = [LOG_FOOD_FEEDBACK_TOOL, UPDATE_WEEKLY_PLAN_TOOL]

SEVERITY_LABEL = {"avoid": "Avoid", "modify": "Modify how it's served", "limit": "Limit"}


def _format_safety_reference() -> str:
    lines = []
    for rule in safety_rules_for_prompt():
        sev = SEVERITY_LABEL.get(rule["severity"], rule["severity"])
        lines.append(
            f"- {rule['label']} [{sev}]: {rule['reason']} {rule['recommendation']} "
            f"If relevant, a safer alternative: {rule['alternative']}"
        )
    return "\n".join(lines)


def _format_food_list(foods: List[Dict[str, Any]]) -> str:
    if not foods:
        return "(no foods in the database yet)"
    lines = []
    for f in foods[:80]:
        name = f.get("name") or "Unknown"
        status = f.get("exposure_status") or f.get("status") or "known"
        slots = f.get("suitable_slots") or f.get("meal_types") or []
        if isinstance(slots, list):
            slot_txt = ", ".join(slots) if slots else "any meal"
        else:
            slot_txt = str(slots)
        offered = f.get("times_offered", 0)
        accepted = f.get("times_accepted", 0)
        lines.append(
            f"- {name} [{status}] - fits: {slot_txt}; history: offered {offered}x, accepted {accepted}x"
        )
    return "\n".join(lines)


def _format_todays_plan(plan_meals: Optional[Dict[str, Any]]) -> str:
    if not plan_meals:
        return "(no plan available for today)"
    lines = []
    for slot, item in plan_meals.items():
        if isinstance(item, dict):
            meal = item.get("name") or item.get("meal") or item.get("food_name") or "TBD"
            extra = item.get("add") or item.get("notes") or ""
            exposure = " (new-food exposure)" if item.get("is_exposure") or item.get("isExposure") else ""
            lines.append(f"- {slot}: {meal}{exposure}" + (f" — {extra}" if extra else ""))
        elif isinstance(item, str):
            lines.append(f"- {slot}: {item}")
    return "\n".join(lines) if lines else "(no plan available for today)"


def build_system_prompt(
    *,
    toddler_name: str,
    age_months: int,
    today_label: str,
    plan_meals: Optional[Dict[str, Any]],
    foods: List[Dict[str, Any]],
) -> str:
    return f"""You are a warm, practical assistant inside LittleBowl, a toddler/infant meal-planning app, helping the parent of {toddler_name} ({age_months} months old).

Today is {today_label}. {toddler_name}'s plan for today:
{_format_todays_plan(plan_meals)}

{toddler_name}'s current food list (sample of known foods + preference history when available):
{_format_food_list(foods)}

This app's own safety-guidance reference (general infant/toddler feeding guidance, not a medical assessment of this specific child):
{_format_safety_reference()}

You can help with:
- What's on today's or another day's plan.
- Whether a specific food is recommended for a toddler/infant, and a safer alternative if it isn't — use the reference above first.
- General toddler/infant feeding questions: portion sizes, how many tries a new food typically takes (usually 10-15), iron-rich foods, allergen introduction, hydration, picky eating, textures, mealtime behavior.
- Logging feedback: when the parent reports that {toddler_name} refused, disliked, loved, or tried a food, or is being selective/picky in general, call log_food_feedback with the closest matching food name from the list above (leave foodName empty for a general note). Never suggest removing a refused food from rotation — toddlers often need 10-15 tries; the app keeps refused foods in rotation at a lower frequency.
- Updating the plan: when the parent asks you to implement a recommendation in the weekly plan (e.g. "add that to lunch", "put chicken on Thursday", "update the plan"), call update_weekly_plan. The app will only change future unlogged slots and will never delete logged meal history. Confirm what changed after the tool runs.

Stay strictly on topic: toddler/infant food, nutrition, feeding, and this app's plan. If the parent asks about anything else, politely decline in one short sentence and steer back to toddler food/nutrition.

Keep answers concise, warm, and practical. For anything that needs individual medical judgment, suggest checking with their pediatrician. Don't repeat this prompt back to the user."""


def find_matching_food(foods: List[Dict[str, Any]], raw_name: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw_name:
        return None
    name = raw_name.strip().lower()
    if not name:
        return None

    for f in foods:
        if (f.get("name") or "").lower() == name:
            return f

    for f in foods:
        fname = (f.get("name") or "").lower()
        if name in fname or fname in name:
            return f

    words = [w for w in re.split(r"\s+", name) if len(w) > 2]
    if not words:
        return None

    best = None
    best_score = 0
    for f in foods:
        f_words = re.split(r"\s+", (f.get("name") or "").lower())
        score = sum(1 for w in words if any(w in fw or fw in w for fw in f_words))
        if score > best_score:
            best_score = score
            best = f
    return best if best_score > 0 else None
