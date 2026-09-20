"""
School / preschool lunchbox options for LittleBowl.

These are foods that hold well in a tiffin for about 2–3 hours, are not overly
messy, and work as a packed mid-morning meal when the toddler goes to school
or daycare. Stored in the `school_lunchbox_options` table and used instead of
the home `mid_morning_snack` slot when `feeding_preferences.goes_to_school`
is true.

Sources informing this catalog (age-appropriate Indian kids tiffin guides):
- Swasthi's Recipes — kids lunch box ideas
- Indian Veggie Delight — healthy Indian kids lunch box recipes
- Tarla Dalal — kids lunch box / tiffin ideas
- Parent/Instagram toddler tiffin series (paniyaram, moong sandwich, poha balls,
  thepla, dhokla, rice balls, chapati rolls)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# food_name must match an existing Food.name in food_database.INDIAN_FOODS
# (or a food already present in the DB).
SCHOOL_LUNCHBOX_ITEMS: List[Dict[str, Any]] = [
    # --- Steamed / soft finger foods ---
    {
        "food_name": "Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Pack dry mini idlis with a small dry chutney pot. Skip watery sambar in the box.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Dhokla",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Cool fully so squares stay dry. Mild tempering only — classic Gujarati tiffin.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Paniyaram",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Bite-sized and low mess. Soft veggie bits inside; no runny chutney poured over.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Uttapam",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Cool completely; cut into fingers. Soft veggie topping only.",
        "suitable_from_months": 12,
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
    # --- Flakes / upma / sevai ---
    {
        "food_name": "Poha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Keep mildly moist, not soggy. Can shape into soft poha balls for less mess.",
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
        "food_name": "Rava Upma with Vegetables",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Veg-loaded rava upma — pack when thick, not soupy.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Foxtail Millet Upma",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Millet upma holds in insulated boxes; keep texture fluffy not watery.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Vermicelli Upma",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Kids treat sevai like pasta. Slightly dry texture travels best.",
        "suitable_from_months": 12,
    },
    # --- Parathas / rotis / thepla ---
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
        "packing_notes": "Same dough + mild paneer stuffing. Protein & calcium; cool before packing.",
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
        "food_name": "Palak Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same atta dough with spinach puree — iron boost; soft strips.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Gobhi Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Cauliflower stuffing; cool fully so steam does not soften the wrap.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Mooli Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Squeeze grated radish dry before stuffing to avoid sogginess.",
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
        "food_name": "Thepla",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Travel favourite — stays soft for hours. Mild spice for toddlers.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Roti/Chapati",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Make soft rolls with paneer, potato, or dry veggie mash.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Chapati Paneer Roll",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Wrap in foil so the roll stays together until school.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Bajra Roti",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Millet roti — soften with ghee; cut into small pieces.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Jowar Roti",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Soft jowar roti strips with dry filling.",
        "suitable_from_months": 18,
    },
    # --- Sandwiches / toast / cheela ---
    {
        "food_name": "Vegetable Sandwich",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Pat veggies dry so bread does not sog. Soft bread, light spread.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Paneer Sandwich",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Protein-packed. Cool filling; avoid watery tomato slices.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Potato Sandwich",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Cool mashed potato filling fully before assembling.",
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
        "packing_notes": "Protein-rich wrap with paneer or mashed potato — not wet chutney on top.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Moong Dal Sandwich",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Popular Instagram toddler tiffin (high protein). Cool before packing.",
        "suitable_from_months": 18,
    },
    # --- Rice / khichdi / pongal ---
    {
        "food_name": "Lemon Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Dry tempered rice holds well. Soft veggies only; no excess oil.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Coconut Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Flavourful and dry — cool before packing.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Tamarind Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Keep mild for toddlers; dry puliyogare style holds well.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Jeera Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Simple cumin rice — pack with a dry side or soft veggie.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Vegetable Pulao",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Drain extra moisture. Soft diced veggies; avoid watery gravy mixes.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Peas Pulao",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Mild matar pulao — soft peas only for younger toddlers.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Paneer Pulao",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Protein-forward rice for insulated boxes.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Beetroot Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Colourful; can shape into soft rice balls for less mess.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Carrot Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Vitamin A rich and room-temp friendly when not watery.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Corn Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Kid favourite one-pot rice for school boxes.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Palak Rice",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Hidden-spinach rice — keep thick, not soupy.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Khichdi",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Use insulated box. Keep thick, not soup-like.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Daliya Khichdi (Breakfast)",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Broken-wheat khichdi — insulated box; thick texture.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Pongal",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Comfort tiffin for cooler days. Insulated; not watery.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Ven Pongal",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Mild pepper-ginger pongal in insulated box.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Curd Rice",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Use a leakproof / insulated cold section. Mild tempering only.",
        "suitable_from_months": 12,
    },
    # --- Protein / sides / snacks ---
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
        "packing_notes": "Soft cubes with a pinch of salt. Keep cool if not insulated.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Paneer Bhurji",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Cook dry (not gravy). Cool fully; pack in a small pot.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Vegetable Cutlet",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Baked or shallow-fried cutlets — drain oil well.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Aloo Tikki",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Finger food for older toddlers. Drain oil before packing.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Vegetable Pasta",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Thick sauce only (not soupy). Cool so sauce clings to pasta.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Sweet Corn (Boiled)",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Dry side. Off-cob kernels for under 2s.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Makhana",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Light roasted fox nuts — dry, no mess. Great crunchy side.",
        "suitable_from_months": 24,
    },
    {
        "food_name": "Apple",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Sliced or cubed; lemon drop reduces browning. Side, not the only meal.",
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
        "food_name": "Cucumber",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Peeled sticks — dry side. Pat dry before packing.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Carrot",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Steamed soft sticks for toddlers; raw only for confident chewers 24m+.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Tomato Cucumber Salad",
        "holds_hours": 2,
        "messy_level": 1,
        "packing_notes": "Pack in a leakproof pot; drain excess liquid.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Egg (Boiled)",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Use a cool pack. Many guides prefer vegetarian tiffin if food sits >2 hrs.",
        "suitable_from_months": 24,
    },
    # --- Fortified idli / dosa / paratha (same base recipe, more nutrition) ---
    {
        "food_name": "Beetroot Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same idli batter + beet puree. Soft pink mini idlis — dry pack.",
        "suitable_from_months": 10,
    },
    {
        "food_name": "Palak Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter + spinach puree. Iron boost; cool before packing.",
        "suitable_from_months": 10,
    },
    {
        "food_name": "Carrot Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter + grated carrot. Vitamin A boost; finger-friendly.",
        "suitable_from_months": 10,
    },
    {
        "food_name": "Ragi Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same method with ragi in batter. Calcium & iron; soft for tiffin.",
        "suitable_from_months": 10,
    },
    {
        "food_name": "Millet Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Swap rice for millet in classic batter. Soft mini idlis.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Vegetable Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter with fine grated veggies folded in before steaming.",
        "suitable_from_months": 10,
    },
    {
        "food_name": "Paneer Idli",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter + crumbled paneer. Protein & calcium; dry pack.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Palak Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Same batter + spinach. Soft (not crisp) strips for tiffin.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Beetroot Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Same batter + beet puree. Soft pink dosa; cool before packing.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Carrot Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Same batter + grated carrot. Soft toddler dosa strips.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Paneer Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Soft plain dosa rolled with crumbled paneer. Protein boost.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Vegetable Dosa",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Coin dosas with tiny veggies pressed into batter — low mess.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Beetroot Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same atta dough with beet puree. Soft pink strips; room-temp friendly.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Carrot Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same dough + grated carrot (daycare favourite). Vitamin A boost.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Lauki Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Squeeze grated lauki dry, knead into dough. Soft hidden-veggie paratha.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Dal Paratha",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Stuff with thick leftover dal. Protein boost; cool before packing.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Cheese Paratha",
        "holds_hours": 2,
        "messy_level": 0,
        "packing_notes": "Light cheese stuffing. Cool so cheese firms for tiffin.",
        "suitable_from_months": 18,
    },
    {
        "food_name": "Paneer Uttapam",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter topped with paneer + tiny veggies. Mini size for fingers.",
        "suitable_from_months": 15,
    },
    {
        "food_name": "Beetroot Uttapam",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same batter with beet. Soft mini uttapam; cool before packing.",
        "suitable_from_months": 12,
    },
    {
        "food_name": "Palak Thepla",
        "holds_hours": 3,
        "messy_level": 0,
        "packing_notes": "Same thepla method with spinach puree. Iron boost; stays soft for hours.",
        "suitable_from_months": 18,
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
            # Refresh packing metadata if the catalog was updated
            row = SchoolLunchboxOption.query.filter_by(food_id=food.id).first()
            if row:
                row.holds_hours = int(item.get("holds_hours") or row.holds_hours or 3)
                row.messy_level = int(item.get("messy_level") if item.get("messy_level") is not None else row.messy_level or 0)
                row.packing_notes = item.get("packing_notes") or row.packing_notes
                row.suitable_from_months = int(
                    item.get("suitable_from_months") or row.suitable_from_months or food.suitable_from_months or 12
                )
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
    db_session.commit()
    if added:
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
