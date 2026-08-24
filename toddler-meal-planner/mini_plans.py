"""Expert mini-plan templates for guided weaning and situational weeks."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# Each day: meal_type -> food name (matched against Food catalogue at apply time).
MINI_PLAN_TEMPLATES: Dict[str, Dict[str, Any]] = {
    'week1_solids': {
        'title': 'Week 1 solids',
        'subtitle': 'Gentle first tastes — one new food every few days',
        'for_age': '6–8 months',
        'days': [
            {'breakfast': 'Rice Cereal', 'lunch': 'Banana'},
            {'breakfast': 'Ragi Porridge', 'lunch': 'Apple'},
            {'breakfast': 'Moong Dal Water', 'lunch': 'Pumpkin'},
            {'breakfast': 'Rice Cereal', 'lunch': 'Sweet Potato'},
            {'breakfast': 'Ragi Porridge', 'lunch': 'Carrot'},
            {'breakfast': 'Banana', 'lunch': 'Moong Dal Water'},
            {'breakfast': 'Apple', 'lunch': 'Pumpkin'},
        ],
    },
    'iron_boost': {
        'title': 'Iron boost week',
        'subtitle': 'Iron-rich foods for growing babies',
        'for_age': '8–12 months',
        'days': [
            {'breakfast': 'Ragi Porridge', 'lunch': 'Khichdi', 'dinner': 'Spinach'},
            {'breakfast': 'Dalia', 'lunch': 'Moong Dal Water', 'dinner': 'Rajma'},
            {'breakfast': 'Khichdi', 'lunch': 'Paneer', 'dinner': 'Spinach'},
            {'breakfast': 'Ragi Porridge', 'lunch': 'Dalia', 'dinner': 'Khichdi'},
            {'breakfast': 'Moong Dal Water', 'lunch': 'Rajma', 'dinner': 'Paneer'},
            {'breakfast': 'Khichdi', 'lunch': 'Spinach', 'dinner': 'Dalia'},
            {'breakfast': 'Ragi Porridge', 'lunch': 'Khichdi', 'dinner': 'Moong Dal Water'},
        ],
    },
    'travel_khichdi': {
        'title': 'Travel-friendly week',
        'subtitle': 'Simple, packable meals for busy days',
        'for_age': '10–12 months',
        'days': [
            {'breakfast': 'Khichdi', 'lunch': 'Idli', 'evening_snack': 'Banana'},
            {'breakfast': 'Poha', 'lunch': 'Khichdi', 'evening_snack': 'Curd'},
            {'breakfast': 'Idli', 'lunch': 'Dalia', 'evening_snack': 'Banana'},
            {'breakfast': 'Khichdi', 'lunch': 'Poha', 'evening_snack': 'Curd'},
            {'breakfast': 'Dalia', 'lunch': 'Idli', 'evening_snack': 'Banana'},
            {'breakfast': 'Poha', 'lunch': 'Khichdi', 'evening_snack': 'Curd'},
            {'breakfast': 'Idli', 'lunch': 'Poha', 'evening_snack': 'Banana'},
        ],
    },
}


def list_mini_plans(age_months: Optional[int] = None) -> List[Dict[str, Any]]:
    out = []
    for key, tpl in MINI_PLAN_TEMPLATES.items():
        out.append({
            'key': key,
            'title': tpl['title'],
            'subtitle': tpl['subtitle'],
            'for_age': tpl.get('for_age'),
        })
    if age_months is not None and age_months >= 12:
        return [p for p in out if p['key'] != 'week1_solids']
    return out


def get_mini_plan_template(key: str) -> Optional[Dict[str, Any]]:
    tpl = MINI_PLAN_TEMPLATES.get(key)
    if not tpl:
        return None
    return {'key': key, **tpl}
