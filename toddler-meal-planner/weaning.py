"""
Weaning journey for infants starting solids (roughly 6-12 months).

Weaning is a different activity from meal planning. A weekly plan of five
varied meals is right for a toddler and wrong for a baby, whose parent is
working through one new food at a time, watching for reactions, deliberately
introducing allergens, and stepping up texture as chewing develops.

Guidance follows WHO complementary feeding advice and the current consensus
(LEAP/EAT trials, NHS and AAP) that common allergens should be introduced
early and one at a time rather than delayed.

Nothing here is medical advice for an individual child; the UI says so too.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

# Days to wait after a genuinely new food before introducing the next one, so a
# reaction can be attributed to a single food.
NEW_FOOD_WATCH_DAYS = 3

WEANING_MAX_MONTHS = 12
WEANING_MIN_MONTHS = 6


STAGES = [
    {
        'key': 'first_tastes',
        'from_months': 6,
        'to_months': 8,
        'title': 'First tastes',
        'texture': 'Smooth purée, thin enough to drop off a spoon',
        'meals_per_day': '1 to 2 small tastes a day',
        'amount': 'Start with 1-2 teaspoons and follow your baby',
        'milk_note': 'Breast milk or formula is still the main food. Solids are practice.',
        'signs': [
            'Sits up with support and holds their head steady',
            'Opens their mouth when food comes near',
            'Can move food to the back of the mouth and swallow',
        ],
        'tips': [
            'Offer food when your baby is happy, not starving or sleepy',
            'Let them touch and play with the food',
            'Stop when they turn their head away',
        ],
    },
    {
        'key': 'more_texture',
        'from_months': 8,
        'to_months': 10,
        'title': 'Thicker food and lumps',
        'texture': 'Mashed with soft lumps, plus soft finger foods to hold',
        'meals_per_day': '2 to 3 meals a day',
        'amount': 'A few tablespoons, growing with appetite',
        'milk_note': 'Milk feeds continue alongside meals.',
        'signs': [
            'Manages a spoon of purée without pushing it out',
            'Brings toys and food to their mouth',
            'Starts chewing up and down',
        ],
        'tips': [
            'Move off fully smooth purée now — waiting too long makes lumps harder to accept',
            'Offer soft strips they can hold, about the size of your finger',
            'Expect gagging sometimes; it is noisy and normal, and different from choking',
        ],
    },
    {
        'key': 'family_food',
        'from_months': 10,
        'to_months': 12,
        'title': 'Towards family food',
        'texture': 'Soft chopped pieces and finger foods',
        'meals_per_day': '3 meals plus 1 to 2 snacks',
        'amount': 'Roughly a quarter to a third of an adult portion',
        'milk_note': 'Food becomes the main source of nutrition; milk moves alongside it.',
        'signs': [
            'Picks up small pieces between finger and thumb',
            'Chews with a rotary, side-to-side motion',
            'Wants what everyone else is eating',
        ],
        'tips': [
            'Serve a softer, unsalted version of the family meal',
            'Let them try a spoon themselves, mess included',
            'Offer water in an open or straw cup with meals',
        ],
    },
]


# Ordered so that the lowest-allergy, easiest-to-digest foods come first. Names
# match the food catalogue where possible so a trial can link to a Food row.
FIRST_FOODS = [
    {'stage': 'first_tastes', 'name': 'Ragi Porridge', 'hindi': 'रागी', 'why': 'Iron and calcium rich, gentle on the stomach'},
    {'stage': 'first_tastes', 'name': 'Rice Cereal', 'hindi': 'चावल', 'why': 'Very low allergy risk, easy first grain'},
    {'stage': 'first_tastes', 'name': 'Moong Dal Water', 'hindi': 'मूंग दाल', 'why': 'Light protein, easy to digest'},
    {'stage': 'first_tastes', 'name': 'Banana', 'hindi': 'केला', 'why': 'Sweet, no cooking needed, mashes smooth'},
    {'stage': 'first_tastes', 'name': 'Apple', 'hindi': 'सेब', 'why': 'Steam until soft, then purée'},
    {'stage': 'first_tastes', 'name': 'Pumpkin', 'hindi': 'कद्दू', 'why': 'Naturally sweet and rich in vitamin A'},
    {'stage': 'first_tastes', 'name': 'Sweet Potato', 'hindi': 'शकरकंद', 'why': 'Vitamin A, purées very smooth'},
    {'stage': 'first_tastes', 'name': 'Carrot', 'hindi': 'गाजर', 'why': 'Steam well; a good early vegetable'},
    {'stage': 'more_texture', 'name': 'Dalia', 'hindi': 'दलिया', 'why': 'Broken wheat, good for moving to lumps'},
    {'stage': 'more_texture', 'name': 'Khichdi', 'hindi': 'खिचड़ी', 'why': 'Rice and dal together give a fuller protein'},
    {'stage': 'more_texture', 'name': 'Curd', 'hindi': 'दही', 'why': 'Calcium and gut-friendly bacteria'},
    {'stage': 'more_texture', 'name': 'Paneer', 'hindi': 'पनीर', 'why': 'Soft protein that can be crumbled'},
    {'stage': 'more_texture', 'name': 'Spinach', 'hindi': 'पालक', 'why': 'Iron; cook well and purée or chop fine'},
    {'stage': 'more_texture', 'name': 'Bottle Gourd', 'hindi': 'लौकी', 'why': 'Very light and easy to digest'},
    {'stage': 'family_food', 'name': 'Idli', 'hindi': 'इडली', 'why': 'Steamed and soft, easy to hold'},
    {'stage': 'family_food', 'name': 'Roti', 'hindi': 'रोटी', 'why': 'Soften in milk or dal to start'},
    {'stage': 'family_food', 'name': 'Rajma', 'hindi': 'राजमा', 'why': 'Protein and iron; mash well'},
    {'stage': 'family_food', 'name': 'Poha', 'hindi': 'पोहा', 'why': 'Soft flattened rice, iron rich'},
]


# Current guidance is to introduce these early and one at a time, not to delay
# them. Peanut and egg first because that is where the trial evidence is
# strongest.
ALLERGENS = [
    {'key': 'peanut', 'label': 'Peanut', 'how': 'A thin smear of smooth peanut butter mixed into porridge. Never a spoonful, and never whole nuts.', 'priority': 1},
    {'key': 'egg', 'label': 'Egg', 'how': 'Well-cooked, mashed yolk to start, then the whole egg.', 'priority': 2},
    {'key': 'dairy', 'label': 'Dairy', 'how': 'Curd or paneer. Cow milk as a drink waits until 12 months.', 'priority': 3},
    {'key': 'wheat', 'label': 'Wheat', 'how': 'Dalia or soft roti soaked in dal.', 'priority': 4},
    {'key': 'soy', 'label': 'Soy', 'how': 'Soft tofu, mashed.', 'priority': 5},
    {'key': 'tree_nuts', 'label': 'Tree nuts', 'how': 'Finely ground almond or cashew powder stirred into food.', 'priority': 6},
    {'key': 'sesame', 'label': 'Sesame', 'how': 'A little til powder or smooth tahini mixed in.', 'priority': 7},
    {'key': 'fish', 'label': 'Fish', 'how': 'Well-cooked, deboned with great care, flaked fine.', 'priority': 8},
    {'key': 'shellfish', 'label': 'Shellfish', 'how': 'Cooked thoroughly and chopped very fine.', 'priority': 9},
]


NEVER_BEFORE_ONE = [
    {'item': 'Honey', 'why': 'Can cause infant botulism before 12 months. This includes honey cooked into food.'},
    {'item': 'Cow milk as a drink', 'why': 'Hard on young kidneys and low in iron. Curd and paneer in food are fine.'},
    {'item': 'Added salt', 'why': "A baby's kidneys cannot handle it. Cook their portion before salting the family's."},
    {'item': 'Added sugar and honey drinks', 'why': 'No benefit, and it builds a preference for sweet food.'},
    {'item': 'Whole nuts, whole grapes, popcorn, raw hard veg', 'why': 'Choking hazards. Grind, quarter lengthwise, or cook soft.'},
    {'item': 'Unpasteurised milk or cheese', 'why': 'Risk of infection.'},
]


REACTION_SIGNS = {
    'urgent': [
        'Swelling of the lips, tongue or face',
        'Trouble breathing, wheezing, or a hoarse cry',
        'Going pale or floppy',
    ],
    'watch': [
        'Hives or a raised red rash',
        'Vomiting soon after eating',
        'Lots of new loose stools',
        'Sudden bad eczema flare',
    ],
}


# What the parent physically has to do to a planned dish before serving it.
#
# This is deliberately not a filter on Food.texture. That column describes the
# cooked dish, not the infant preparation: 158 of ~194 catalogue foods are
# "soft", and of the 17 suitable from 6 months exactly one is tagged "puree".
# Filtering on it would leave a 6-month-old with a single food. Telling the
# parent how to prepare whatever is planned is both accurate and more useful.
STAGE_PREP = {
    'first_tastes': 'Blend or sieve until completely smooth. Loosen with milk or water so it drops off a spoon.',
    'more_texture': 'Mash with a fork and leave soft lumps. Add a few soft strips they can hold.',
    'family_food': 'Chop into soft pieces they can pick up. Nothing hard, round or sticky.',
}


def prep_note(age_months: Optional[int]) -> Optional[str]:
    """How to prepare a planned meal for this age, or None once weaning is over."""
    if not is_weaning_age(age_months):
        return None
    return STAGE_PREP[stage_for_age(age_months)['key']]


def plan_context(age_months: Optional[int]) -> Optional[Dict[str, Any]]:
    """Weaning banner for a weekly plan, or None for children past 12 months."""
    if not is_weaning_age(age_months):
        return None
    stage = stage_for_age(age_months)
    return {
        'stage_key': stage['key'],
        'stage_title': stage['title'],
        'texture': stage['texture'],
        'meals_per_day': stage['meals_per_day'],
        'amount': stage['amount'],
        'milk_note': stage['milk_note'],
        'prep_note': STAGE_PREP[stage['key']],
    }


def stage_for_age(age_months: int) -> Dict[str, Any]:
    """The weaning stage a given age falls in, clamped at both ends."""
    for stage in STAGES:
        if age_months < stage['to_months']:
            return stage
    return STAGES[-1]


def is_weaning_age(age_months: Optional[int]) -> bool:
    if age_months is None:
        return False
    return WEANING_MIN_MONTHS <= age_months < WEANING_MAX_MONTHS


def _stages_up_to(stage_key: str) -> List[str]:
    keys = [s['key'] for s in STAGES]
    if stage_key not in keys:
        return keys
    return keys[: keys.index(stage_key) + 1]


def build_journey(
    *,
    age_months: int,
    tried: List[Dict[str, Any]],
    allergies: Optional[List[str]] = None,
    introduced_allergens: Optional[List[str]] = None,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Assemble the weaning state for one child.

    `tried` is a list of {name, last_offered (date|None), reaction} drawn from
    the child's food preference history, so a food logged through the normal
    meal flow counts here too — the parent does not have to record things twice.
    """
    today = today or date.today()
    seen_allergens = {a.strip().lower() for a in (introduced_allergens or [])}
    avoid = {a.strip().lower() for a in (allergies or [])}
    stage = stage_for_age(age_months)
    allowed_stages = set(_stages_up_to(stage['key']))

    tried_by_name = {}
    for entry in tried:
        name = (entry.get('name') or '').strip().lower()
        if name:
            tried_by_name[name] = entry

    # A food only counts as introduced once it has actually been offered.
    done, todo = [], []
    for food in FIRST_FOODS:
        if food['stage'] not in allowed_stages:
            continue
        record = tried_by_name.get(food['name'].strip().lower())
        item = {
            'name': food['name'],
            'hindi': food['hindi'],
            'why': food['why'],
            'stage': food['stage'],
        }
        if record:
            item['last_offered'] = (
                record['last_offered'].isoformat() if record.get('last_offered') else None
            )
            item['reaction'] = record.get('reaction')
            done.append(item)
        else:
            todo.append(item)

    # The watch window runs from the most recent brand-new food.
    last_new_date = None
    for entry in done:
        if entry.get('last_offered'):
            d = date.fromisoformat(entry['last_offered'])
            if last_new_date is None or d > last_new_date:
                last_new_date = d

    wait_until = last_new_date + timedelta(days=NEW_FOOD_WATCH_DAYS) if last_new_date else None
    waiting = bool(wait_until and wait_until > today)
    days_left = (wait_until - today).days if waiting else 0

    allergen_status = []
    for allergen in ALLERGENS:
        allergen_status.append(
            {
                **allergen,
                'introduced': allergen['key'] in seen_allergens,
                # A known allergy means never introduce it here; that is a
                # conversation with a doctor, not a checklist item.
                'skip': allergen['key'] in avoid,
            }
        )
    next_allergen = next(
        (a for a in allergen_status if not a['introduced'] and not a['skip']),
        None,
    )

    return {
        'is_weaning': is_weaning_age(age_months),
        'age_months': age_months,
        'stage': stage,
        'stage_number': [s['key'] for s in STAGES].index(stage['key']) + 1,
        'stage_count': len(STAGES),
        'next_food': todo[0] if todo else None,
        'upcoming_foods': todo[1:4],
        'tried_foods': sorted(done, key=lambda x: x.get('last_offered') or '', reverse=True),
        'tried_count': len(done),
        'total_foods': len(done) + len(todo),
        'watch': {
            'waiting': waiting,
            'days_left': days_left,
            'wait_days': NEW_FOOD_WATCH_DAYS,
            'until': wait_until.isoformat() if wait_until else None,
        },
        'allergens': allergen_status,
        'next_allergen': next_allergen,
        'allergens_done': sum(1 for a in allergen_status if a['introduced']),
        'allergens_total': sum(1 for a in allergen_status if not a['skip']),
        'never_before_one': NEVER_BEFORE_ONE,
        'reaction_signs': REACTION_SIGNS,
    }
