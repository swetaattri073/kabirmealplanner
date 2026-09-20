"""
School / preschool lunchbox options for LittleBowl.

These are foods that hold well in a tiffin for about 2–3 hours, are not overly
messy, and work as a packed mid-morning meal when the toddler goes to school
or daycare. Stored in the `school_lunchbox_options` table and used instead of
the home `mid_morning_snack` slot when `feeding_preferences.goes_to_school`
is true.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# food_name must match an existing Food.name in food_database.INDIAN_FOODS
# (or a food already present in the DB).
SCHOOL_LUNCHBOX_ITEMS: List[Dict[str, Any]] = [
    {
        "food_name": "Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Pack dry mini idlis with a small dry chutney pot. Skip watery sambar in the box.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Uttapam",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Cool completely; cut into fingers. Soft veggie topping only — no runny chutney poured over.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Poha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Keep mildly moist, not soggy. Avoid excess oil or watery tadka.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Upma",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Use an insulated box. Soft vegetables only; not too watery.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Aloo Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Room-temp friendly. Wrap in foil/cloth. Pack curd separately if needed.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Paneer Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Excellent lunchbox main. Mild stuffing; cool before packing.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Methi Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Holds well at room temperature. Soften with a little ghee if dry.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Paratha (Plain)",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Roll with soft potato/paneer or pack with dry sabzi. Skip runny curry in the same box.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Stuffed Paratha (Vegetable)",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Classic tiffin. Not messy; good for 2–3 hours without reheating.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Vegetable Sandwich",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Use soft bread, light butter/chutney. Avoid watery cucumber slices that soak bread — pat dry.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "French Toast",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Cool fully so it firms up. Mild and finger-friendly.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Besan Chilla",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Roll or cut into strips. Dry filling only.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Moong Dal Cheela",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Protein-rich wrap. Pack with paneer or mashed potato, not wet chutney poured on top.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Lemon Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Dry tempered rice holds well. Soft veggies only; no excess oil.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Vegetable Pulao",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Drain extra moisture. Soft diced veggies; avoid watery gravy mixes.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Khichdi",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Use insulated box. Keep thick, not soup-like.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Roti/Chapati",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Make soft rolls with paneer, potato, or dry veggie mash.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Paneer Tikka",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Dry cubes — easy finger food. Cool before packing.",
        "suitable_from_months": 24,
    },
    {
        "food_name": "Paneer",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Soft cubes with a pinch of salt/hing. Keep cool; eat within ~2 hours if not insulated.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Egg (Boiled)",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Peel at school or pack halved. For eggetarian/non-veg kids only.",
        "suitable_from_months": 24,
    },
    {
        "food_name": "Apple",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Sliced or cubed; toss with a drop of lemon to reduce browning. Side, not the only meal.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Banana",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Pack whole to avoid mush; peel at school. Best as a side.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Makhana",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Light roasted fox nuts — dry, no mess. Good crunchy side for older toddlers.",
        "suitable_from_months": 24,
    },
    {
        "food_name": "Dosa (Plain)",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Cool, roll with potato mash. Soft dosa holds better than crisp restaurant-style.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Ragi Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Iron-rich roll. Soft texture; mild filling.",
        "suitable_from_months": 15,
    },
]


def init_school_lunchbox_options(db_session, Food, SchoolLunchboxOption, force_reseed: bool = False) -> int:
    """Ensure school_lunchbox_options rows exist and point at Food records.

    Returns the number of options present after sync.
    """
    existing = SchoolLunchboxOption.query.count()
    expected = len(SCHOOL_LUNCHBOX_ITEMS)
    if existing >= expected * 0.9 and not force_reseed:
        _add_missing_options(db_session, Food, SchoolLunchboxOption)
        return SchoolLunchboxOption.query.count()

    if force_reseed and existing:
        SchoolLunchboxOption.query.delete()
        db_session.commit()

    _add_missing_options(db_session, Food, SchoolLunchboxOption)
    return SchoolLunchboxOption.query.count()


def _add_missing_options(db_session, Food, SchoolLunchboxOption) -> int:
    added = 0
    linked_ids = {
        row.food_id
        for row in SchoolLunchboxOption.query.with_entities(SchoolLunchboxOption.food_id).all()
    }
    for item in SCHOOL_LUNCHBOX_ITEMS:
        food = Food.query.filter_by(name=item["food_name"]).first()
        if not food:
            continue
        if food.id in linked_ids:
            continue
        row = SchoolLunchboxOption(
            food_id=food.id,
            holds_hours=int(item.get("holds_hours") or 3),
            messy_level=int(item.get("messy_level") or 0),
            packing_notes=item.get("packing_notes"),
            suitable_from_months=int(
                item.get("suitable_from_months") or food.suitable_from_months or 12
            ),
        )
        db_session.add(row)
        linked_ids.add(food.id)
        added += 1
    if added:
        db_session.commit()
        print(f"Added {added} school lunchbox option(s).")
    return added


def school_lunchbox_food_ids(db_session, SchoolLunchboxOption, age_months: Optional[int] = None):
    """Return food_ids from the school lunchbox list, optionally age-filtered."""
    q = SchoolLunchboxOption.query
    if age_months is not None:
        q = q.filter(SchoolLunchboxOption.suitable_from_months <= int(age_months))
    # Prefer less messy options
    q = q.filter(SchoolLunchboxOption.messy_level <= 1)
    return [row.food_id for row in q.all()]
