"""
Food Enhancement & Flavor Exploration System
Suggests ways to boost nutrition in loved foods and explore new similar flavors
"""

# Nutrition boosters - ingredients that can be added to common foods
NUTRITION_BOOSTERS = {
    'protein': {
        'name': 'Protein Boosters',
        'icon': '💪',
        'ingredients': [
            {'name': 'Paneer (grated/cubed)', 'amount': '1-2 tbsp', 'adds': '+3g protein'},
            {'name': 'Curd/Yogurt', 'amount': '2 tbsp', 'adds': '+2g protein'},
            {'name': 'Moong dal powder', 'amount': '1 tsp', 'adds': '+1g protein'},
            {'name': 'Besan (chickpea flour)', 'amount': '1 tsp', 'adds': '+1g protein'},
            {'name': 'Milk powder', 'amount': '1 tsp', 'adds': '+1g protein'},
            {'name': 'Nut butter (if no allergy)', 'amount': '1/2 tsp', 'adds': '+1g protein'},
            {'name': 'Egg (scrambled/boiled)', 'amount': '1/2 egg', 'adds': '+3g protein'},
        ]
    },
    'iron': {
        'name': 'Iron Boosters',
        'icon': '🩸',
        'ingredients': [
            {'name': 'Ragi flour', 'amount': '1 tbsp', 'adds': '+1mg iron'},
            {'name': 'Dates (mashed)', 'amount': '1-2 dates', 'adds': '+0.5mg iron'},
            {'name': 'Jaggery powder', 'amount': '1/2 tsp', 'adds': '+0.5mg iron'},
            {'name': 'Spinach puree', 'amount': '1 tbsp', 'adds': '+0.5mg iron'},
            {'name': 'Beetroot puree', 'amount': '1 tbsp', 'adds': '+0.3mg iron'},
            {'name': 'Dry fruits powder', 'amount': '1 tsp', 'adds': '+0.5mg iron'},
            {'name': 'Black sesame powder', 'amount': '1/2 tsp', 'adds': '+0.5mg iron'},
        ],
        'tip': 'Add vitamin C (lemon/orange juice) to boost iron absorption!'
    },
    'calcium': {
        'name': 'Calcium Boosters',
        'icon': '🦴',
        'ingredients': [
            {'name': 'Ragi flour', 'amount': '1 tbsp', 'adds': '+50mg calcium'},
            {'name': 'Milk/Curd', 'amount': '2 tbsp', 'adds': '+40mg calcium'},
            {'name': 'Cheese (grated)', 'amount': '1 tsp', 'adds': '+30mg calcium'},
            {'name': 'Sesame seeds powder', 'amount': '1/2 tsp', 'adds': '+25mg calcium'},
            {'name': 'Amaranth flour', 'amount': '1 tsp', 'adds': '+20mg calcium'},
            {'name': 'Paneer', 'amount': '1 tbsp', 'adds': '+25mg calcium'},
        ]
    },
    'calories': {
        'name': 'Calorie Boosters (for underweight)',
        'icon': '⚡',
        'ingredients': [
            {'name': 'Ghee', 'amount': '1 tsp', 'adds': '+45 kcal'},
            {'name': 'Coconut (fresh/powder)', 'amount': '1 tbsp', 'adds': '+35 kcal'},
            {'name': 'Dry fruits powder', 'amount': '1 tsp', 'adds': '+30 kcal'},
            {'name': 'Nut butter', 'amount': '1/2 tsp', 'adds': '+25 kcal'},
            {'name': 'Banana (mashed)', 'amount': '1/4 banana', 'adds': '+25 kcal'},
            {'name': 'Avocado', 'amount': '1 tbsp', 'adds': '+25 kcal'},
            {'name': 'Cream/Malai', 'amount': '1 tsp', 'adds': '+20 kcal'},
        ]
    },
    'fiber': {
        'name': 'Fiber Boosters (for constipation)',
        'icon': '🥬',
        'ingredients': [
            {'name': 'Oats powder', 'amount': '1 tbsp', 'adds': '+1g fiber'},
            {'name': 'Flax seed powder', 'amount': '1/2 tsp', 'adds': '+1g fiber'},
            {'name': 'Prune puree', 'amount': '1 tbsp', 'adds': '+0.5g fiber'},
            {'name': 'Papaya (mashed)', 'amount': '2 tbsp', 'adds': '+0.5g fiber'},
            {'name': 'Apple (grated)', 'amount': '1 tbsp', 'adds': '+0.5g fiber'},
            {'name': 'Peas (mashed)', 'amount': '1 tbsp', 'adds': '+0.5g fiber'},
        ]
    },
    'vitamins': {
        'name': 'Vitamin Boosters',
        'icon': '🌟',
        'ingredients': [
            {'name': 'Carrot puree (Vit A)', 'amount': '1 tbsp', 'adds': 'Vitamin A'},
            {'name': 'Sweet potato (Vit A)', 'amount': '1 tbsp', 'adds': 'Vitamin A'},
            {'name': 'Orange juice (Vit C)', 'amount': '1 tbsp', 'adds': 'Vitamin C'},
            {'name': 'Lemon juice (Vit C)', 'amount': 'few drops', 'adds': 'Vitamin C'},
            {'name': 'Amla powder (Vit C)', 'amount': 'pinch', 'adds': 'Vitamin C'},
            {'name': 'Egg yolk (Vit D, B12)', 'amount': '1 yolk', 'adds': 'Vitamin D, B12'},
        ]
    }
}

# Food-specific enhancement suggestions
FOOD_ENHANCEMENTS = {
    # Grains
    'Rice (Cooked)': {
        'boosts': [
            {'method': 'Mix with dal', 'benefit': 'Complete protein', 'how': 'Mash dal into rice'},
            {'method': 'Add ghee + turmeric', 'benefit': 'Immunity + calories', 'how': '1 tsp ghee + pinch turmeric'},
            {'method': 'Add vegetable puree', 'benefit': 'Hidden veggies', 'how': 'Mix spinach/carrot puree'},
            {'method': 'Make curd rice', 'benefit': 'Probiotics + calcium', 'how': 'Mix with fresh curd'},
        ],
        'flavor_variations': [
            'Jeera rice (cumin flavor)',
            'Coconut rice (South Indian)',
            'Tomato rice (tangy)',
            'Vegetable pulao (colorful)',
            'Lemon rice (citrusy)',
        ]
    },
    'Roti/Chapati': {
        'boosts': [
            {'method': 'Add ragi flour', 'benefit': 'Iron + calcium', 'how': 'Mix 1:3 ragi:wheat'},
            {'method': 'Add spinach puree', 'benefit': 'Hidden iron', 'how': 'Knead with spinach puree'},
            {'method': 'Add methi leaves', 'benefit': 'Iron + fiber', 'how': 'Mix finely chopped methi'},
            {'method': 'Stuff with paneer', 'benefit': 'Protein + calcium', 'how': 'Make paneer paratha'},
        ],
        'flavor_variations': [
            'Palak paratha (green, iron-rich)',
            'Methi paratha (aromatic)',
            'Mooli paratha (tangy)',
            'Gobhi paratha (mild)',
            'Paneer paratha (creamy)',
        ]
    },
    'Khichdi': {
        'boosts': [
            {'method': 'Add extra ghee', 'benefit': 'Calories + brain food', 'how': '1-2 tsp ghee on top'},
            {'method': 'Add vegetables', 'benefit': 'Vitamins + fiber', 'how': 'Mix peas, carrots, beans'},
            {'method': 'Use ragi + moong', 'benefit': 'Iron + protein', 'how': 'Replace some rice with ragi'},
            {'method': 'Add paneer cubes', 'benefit': 'Protein + calcium', 'how': 'Mix soft paneer pieces'},
        ],
        'flavor_variations': [
            'Vegetable khichdi',
            'Palak khichdi (green)',
            'Masala khichdi (mild spices)',
            'Sabudana khichdi (different texture)',
            'Daliya khichdi (more fiber)',
        ]
    },
    'Idli': {
        'boosts': [
            {'method': 'Add ragi to batter', 'benefit': 'Iron + calcium', 'how': 'Mix ragi flour in batter'},
            {'method': 'Add vegetable puree', 'benefit': 'Hidden veggies', 'how': 'Mix carrot/beetroot puree in batter'},
            {'method': 'Serve with coconut chutney', 'benefit': 'Healthy fats', 'how': 'Fresh coconut chutney'},
            {'method': 'Add oats to batter', 'benefit': 'Fiber', 'how': 'Replace some rice with oats'},
        ],
        'flavor_variations': [
            'Rava idli (instant, different texture)',
            'Ragi idli (brown, iron-rich)',
            'Oats idli (fiber-rich)',
            'Vegetable idli (colorful)',
            'Mini idlis (fun size)',
        ]
    },
    'Dosa (Plain)': {
        'boosts': [
            {'method': 'Make set dosa (soft)', 'benefit': 'Easier to eat', 'how': 'Thicker, softer version'},
            {'method': 'Add moong dal to batter', 'benefit': 'Protein', 'how': 'Pesarattu style'},
            {'method': 'Fill with paneer', 'benefit': 'Protein + calcium', 'how': 'Paneer masala filling'},
            {'method': 'Add vegetables', 'benefit': 'Vitamins', 'how': 'Onion-tomato filling'},
        ],
        'flavor_variations': [
            'Rava dosa (instant, crispy)',
            'Set dosa (soft, thick)',
            'Pesarattu (moong dal, protein-rich)',
            'Uttapam (thick with toppings)',
            'Neer dosa (rice-based, soft)',
        ]
    },
    'Banana': {
        'boosts': [
            {'method': 'Mash with dry fruits', 'benefit': 'Iron + calories', 'how': 'Add date/almond powder'},
            {'method': 'Mix with curd', 'benefit': 'Protein + probiotics', 'how': 'Banana curd smoothie'},
            {'method': 'Add to porridge', 'benefit': 'Natural sweetness', 'how': 'Mash into oats/ragi'},
            {'method': 'Make pancakes', 'benefit': 'Fun + protein', 'how': 'Banana + egg + oats pancake'},
        ],
        'flavor_variations': [
            'Banana smoothie (with milk)',
            'Banana pancakes (with oats)',
            'Banana mash with date paste',
            'Frozen banana (ice cream texture)',
            'Banana with nut butter',
        ]
    },
    'Milk (Whole)': {
        'boosts': [
            {'method': 'Add turmeric', 'benefit': 'Immunity', 'how': 'Golden milk (haldi doodh)'},
            {'method': 'Add dry fruits powder', 'benefit': 'Iron + energy', 'how': 'Blend soaked almonds/dates'},
            {'method': 'Add ragi malt', 'benefit': 'Iron + calcium', 'how': 'Ragi porridge consistency'},
            {'method': 'Add banana', 'benefit': 'Energy + potassium', 'how': 'Banana milkshake'},
        ],
        'flavor_variations': [
            'Badam milk (almond)',
            'Kesar milk (saffron)',
            'Elaichi milk (cardamom)',
            'Chocolate milk (cocoa)',
            'Banana milkshake',
        ]
    },
    'Curd/Yogurt': {
        'boosts': [
            {'method': 'Add fruits', 'benefit': 'Vitamins + fiber', 'how': 'Mash banana/mango into curd'},
            {'method': 'Add jaggery or date paste (no honey under 12 months)', 'benefit': 'Iron (jaggery)', 'how': 'Natural sweetener — avoid honey before age 1'},
            {'method': 'Mix with rice', 'benefit': 'Complete meal', 'how': 'Curd rice with salt'},
            {'method': 'Add dry fruits', 'benefit': 'Iron + calories', 'how': 'Chopped dates/raisins'},
        ],
        'flavor_variations': [
            'Fruit raita (sweet)',
            'Shrikhand (dessert)',
            'Lassi (sweet/salty)',
            'Curd rice (savory)',
            'Smoothie bowl (with fruits)',
        ]
    },
    'Paneer': {
        'boosts': [
            {'method': 'Mash for younger babies', 'benefit': 'Easier to eat', 'how': 'Crumble finely'},
            {'method': 'Mix with vegetables', 'benefit': 'Hidden veggies', 'how': 'Palak paneer (mild)'},
            {'method': 'Add to parathas', 'benefit': 'Complete meal', 'how': 'Paneer paratha'},
            {'method': 'Make cutlets', 'benefit': 'Fun finger food', 'how': 'Shallow fry paneer cutlets'},
        ],
        'flavor_variations': [
            'Plain paneer cubes',
            'Paneer bhurji (scrambled)',
            'Palak paneer (with spinach)',
            'Paneer paratha',
            'Paneer tikka (mild)',
        ]
    },
    'Moong Dal': {
        'boosts': [
            {'method': 'Add vegetables', 'benefit': 'Vitamins + fiber', 'how': 'Add lauki, carrots, spinach'},
            {'method': 'Add ghee tadka', 'benefit': 'Calories + taste', 'how': 'Ghee + cumin tempering'},
            {'method': 'Make cheela', 'benefit': 'Finger food', 'how': 'Moong dal cheela/dosa'},
            {'method': 'Mix with rice', 'benefit': 'Complete protein', 'how': 'Dal chawal or khichdi'},
        ],
        'flavor_variations': [
            'Plain dal with tadka',
            'Dal fry (thicker)',
            'Dal khichdi',
            'Moong dal cheela',
            'Moong dal soup',
        ]
    },
    'Egg (Boiled)': {
        'boosts': [
            {'method': 'Mash yolk first', 'benefit': 'Iron + B12', 'how': 'Start with yolk only'},
            {'method': 'Add to rice/khichdi', 'benefit': 'Complete meal', 'how': 'Egg rice bowl'},
            {'method': 'Make bhurji with veggies', 'benefit': 'Hidden veggies', 'how': 'Scramble with tomato, onion'},
            {'method': 'Make egg paratha', 'benefit': 'Protein-packed meal', 'how': 'Wrap in roti'},
        ],
        'flavor_variations': [
            'Boiled egg (plain)',
            'Egg bhurji (scrambled)',
            'Egg curry (mild)',
            'Egg fried rice',
            'Egg sandwich',
        ]
    },
    'Oats Porridge': {
        'boosts': [
            {'method': 'Add banana/apple', 'benefit': 'Natural sweetness + fiber', 'how': 'Mash fruits in'},
            {'method': 'Add dry fruits powder', 'benefit': 'Iron + calories', 'how': 'Almond/date powder'},
            {'method': 'Use milk instead of water', 'benefit': 'Protein + calcium', 'how': 'Cook in milk'},
            {'method': 'Add ghee', 'benefit': 'Calories + taste', 'how': '1 tsp ghee'},
        ],
        'flavor_variations': [
            'Sweet oats (with jaggery)',
            'Savory oats (upma style)',
            'Banana oats',
            'Apple cinnamon oats',
            'Oats smoothie',
        ]
    },
}

# Flavor profiles for exploration
FLAVOR_PROFILES = {
    'mild_sweet': {
        'description': 'Naturally sweet, mild flavors',
        'foods': ['Banana', 'Sweet Potato', 'Carrot', 'Apple', 'Chikoo/Sapota', 'Mango', 'Papaya', 'Dates'],
        'try_next': ['Pumpkin', 'Beetroot', 'Coconut', 'Ragi Porridge (with jaggery)']
    },
    'creamy': {
        'description': 'Smooth, creamy textures',
        'foods': ['Curd/Yogurt', 'Paneer', 'Khichdi', 'Banana', 'Avocado', 'Milk'],
        'try_next': ['Cheese', 'Suji Halwa', 'Curd Rice', 'Mashed Potato']
    },
    'soft_grains': {
        'description': 'Soft grain-based foods',
        'foods': ['Idli', 'Rice (Cooked)', 'Khichdi', 'Daliya/Broken Wheat Porridge', 'Upma'],
        'try_next': ['Dosa (soft)', 'Uttapam', 'Pongal', 'Oats Porridge', 'Ragi Porridge']
    },
    'tangy': {
        'description': 'Slightly sour/tangy',
        'foods': ['Curd/Yogurt', 'Tomato', 'Orange', 'Curd Rice', 'Sambar'],
        'try_next': ['Lemon Rice', 'Rasam (mild)', 'Buttermilk', 'Tamarind Rice']
    },
    'savory_mild': {
        'description': 'Savory with mild spices',
        'foods': ['Dal Rice', 'Khichdi', 'Upma', 'Poha', 'Vegetable Pulao'],
        'try_next': ['Pongal', 'Bisibele Bath (mild)', 'Vegetable Biryani (mild)', 'Sambar Rice']
    }
}


def get_enhancement_suggestions(food_name, toddler=None):
    """
    Get nutrition boost suggestions for a specific food
    """
    suggestions = FOOD_ENHANCEMENTS.get(food_name, {})
    
    if not suggestions:
        # Try partial match
        for key in FOOD_ENHANCEMENTS:
            if key.lower() in food_name.lower() or food_name.lower() in key.lower():
                suggestions = FOOD_ENHANCEMENTS[key]
                break
    
    result = {
        'food': food_name,
        'boosts': suggestions.get('boosts', []),
        'flavor_variations': suggestions.get('flavor_variations', []),
        'general_boosters': []
    }
    
    # Add health-specific boosters if toddler provided
    if toddler:
        priorities = toddler.get_nutrition_priorities()
        weight_status = toddler.get_weight_status()
        conditions = toddler.health_conditions or []
        
        # Add relevant general boosters
        if 'protein_g' in priorities:
            result['general_boosters'].append(NUTRITION_BOOSTERS['protein'])
        if 'iron_mg' in priorities or 'anemia' in conditions:
            result['general_boosters'].append(NUTRITION_BOOSTERS['iron'])
        if 'calcium_mg' in priorities:
            result['general_boosters'].append(NUTRITION_BOOSTERS['calcium'])
        if weight_status in ['underweight', 'severely_underweight']:
            result['general_boosters'].append(NUTRITION_BOOSTERS['calories'])
        if 'constipation' in conditions or 'fiber_g' in priorities:
            result['general_boosters'].append(NUTRITION_BOOSTERS['fiber'])
    
    return result


def get_flavor_exploration(liked_foods, toddler=None):
    """
    Suggest new foods to try based on flavor profiles of liked foods
    """
    # Identify flavor profiles from liked foods
    matched_profiles = []
    
    for profile_key, profile in FLAVOR_PROFILES.items():
        for liked in liked_foods:
            food_name = liked.get('name', '') if isinstance(liked, dict) else str(liked)
            if any(pf.lower() in food_name.lower() for pf in profile['foods']):
                matched_profiles.append(profile_key)
                break
    
    # Get unique profiles
    matched_profiles = list(set(matched_profiles))
    
    # Compile suggestions
    suggestions = []
    already_liked = set(f.get('name', '').lower() if isinstance(f, dict) else str(f).lower() 
                       for f in liked_foods)
    
    for profile_key in matched_profiles:
        profile = FLAVOR_PROFILES[profile_key]
        new_foods = [f for f in profile['try_next'] 
                    if f.lower() not in already_liked]
        
        if new_foods:
            suggestions.append({
                'profile': profile_key,
                'description': profile['description'],
                'because_likes': [f for f in profile['foods'] 
                                 if any(f.lower() in l.lower() if isinstance(l, str) 
                                       else f.lower() in l.get('name', '').lower() 
                                       for l in liked_foods)],
                'try_these': new_foods[:3]  # Top 3 suggestions
            })
    
    return {
        'liked_foods': [f.get('name') if isinstance(f, dict) else f for f in liked_foods],
        'flavor_profiles_identified': matched_profiles,
        'suggestions': suggestions
    }


def get_daily_enhancement_tip(toddler, liked_foods=None):
    """
    Get a daily tip for enhancing a random liked food
    """
    import random
    
    if not liked_foods:
        return None
    
    # Pick a random liked food that has enhancements
    foods_with_tips = [f for f in liked_foods 
                      if (f.get('name') if isinstance(f, dict) else f) in FOOD_ENHANCEMENTS]
    
    if not foods_with_tips:
        return None
    
    chosen = random.choice(foods_with_tips)
    food_name = chosen.get('name') if isinstance(chosen, dict) else chosen
    
    enhancements = FOOD_ENHANCEMENTS.get(food_name, {})
    
    if not enhancements.get('boosts'):
        return None
    
    boost = random.choice(enhancements['boosts'])
    
    return {
        'food': food_name,
        'tip_type': 'nutrition_boost',
        'title': f"Make {food_name} more nutritious!",
        'method': boost['method'],
        'benefit': boost['benefit'],
        'how': boost['how']
    }


def get_all_boosters():
    """Get all nutrition boosters for display"""
    return NUTRITION_BOOSTERS


def get_all_enhancements():
    """Get all food enhancements for display"""
    return FOOD_ENHANCEMENTS
