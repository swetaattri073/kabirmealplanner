"""
AI Features for Toddler Meal Planner
- Natural Language Meal Parsing
- Food Similarity (Semantic Search)
- Image-based Food Recognition (placeholder for TensorFlow.js integration)

These features work OFFLINE without cloud APIs.
"""

import re
from difflib import SequenceMatcher
from collections import defaultdict


# ==================== NATURAL LANGUAGE MEAL PARSING ====================

# Food name variations and aliases (English + Hindi + common misspellings)
FOOD_ALIASES = {
    # Grains
    'rice': ['chawal', 'chaval', 'bhat', 'cooked rice', 'plain rice', 'white rice'],
    'roti': ['chapati', 'chapatti', 'phulka', 'rotis'],
    'paratha': ['parantha', 'pratha', 'stuffed roti'],
    'idli': ['idly', 'idlis'],
    'dosa': ['dosai', 'dosas', 'plain dosa'],
    'upma': ['uppma', 'upuma', 'rava upma'],
    'poha': ['pohe', 'flattened rice', 'beaten rice'],
    'khichdi': ['khichadi', 'kichdi', 'kitchdi', 'dal khichdi'],
    'daliya': ['dalia', 'broken wheat', 'bulgur'],
    'oats': ['oatmeal', 'oats porridge'],
    
    # Dals & legumes
    'dal': ['daal', 'dhal', 'lentils', 'pulses'],
    'moong dal': ['moong', 'mung dal', 'green gram', 'moongdaal'],
    'toor dal': ['arhar dal', 'toor', 'pigeon pea', 'arhar'],
    'chana dal': ['bengal gram'],
    'masoor dal': ['masoor', 'red lentils', 'masoordal'],
    'lobia': ['lobhiya', 'lobiya', 'black eyed peas', 'black-eyed peas',
              'black eyed beans', 'chowli', 'chawli', 'rongi'],
    'rajma': ['kidney beans', 'rajmah'],
    'chole': ['chickpeas', 'chhole', 'chhola', 'kabuli chana'],
    'sambar': ['sambhar', 'sambaar'],
    
    # Vegetables
    'potato': ['aloo', 'alu', 'potatoes'],
    'sweet potato': ['shakarkandi', 'shakarkand'],
    'carrot': ['gajar', 'carrots'],
    'spinach': ['palak', 'saag'],
    'pumpkin': ['kaddu', 'sitaphal'],
    'peas': ['matar', 'mutter'],
    'beans': ['sem', 'french beans'],
    'cauliflower': ['gobhi', 'gobi', 'phool gobhi'],
    'tomato': ['tamatar', 'tomatoes'],
    'cucumber': ['kheera', 'kakdi', 'khira', 'cucumbers'],
    'beetroot': ['chukandar', 'beet'],
    'bottle gourd': ['lauki', 'ghiya', 'dudhi'],
    'brinjal': ['baingan', 'eggplant', 'aubergine'],
    'okra': ['bhindi', 'lady finger'],
    
    # Fruits  
    'banana': ['kela', 'bananas'],
    'apple': ['seb', 'apples'],
    'mango': ['aam', 'mangoes'],
    'papaya': ['papita', 'paw paw'],
    'orange': ['santra', 'narangi', 'oranges'],
    'grapes': ['angoor', 'angur'],
    'pomegranate': ['anar', 'anaar'],
    'watermelon': ['tarbooz', 'tarbuj'],
    'chikoo': ['sapota', 'chiku', 'sapodilla'],
    
    # Dairy
    'milk': ['doodh', 'dudh'],
    'curd': ['dahi', 'yogurt', 'yoghurt'],
    'paneer': ['cottage cheese', 'indian cheese'],
    'cheese': ['cheez'],
    'ghee': ['clarified butter', 'desi ghee'],
    'buttermilk': ['chaas', 'mattha'],
    'lassi': ['lassie'],
    
    # Protein
    'egg': ['anda', 'eggs', 'boiled egg', 'scrambled egg', 'omelette', 'omelet'],
    'chicken': ['murgh', 'murgi'],
    'fish': ['machli', 'machhi'],
    
    # Combo dishes
    'dal rice': ['dal chawal', 'daal chawal', 'dal chaawal'],
    'curd rice': ['dahi chawal', 'thayir sadam', 'curd chawal'],
    'kheer': ['payasam', 'rice pudding'],
    'halwa': ['halva', 'sheera'],
    'pulao': ['pilaf', 'pulav', 'vegetable pulao'],
    
    # Snacks
    'biscuit': ['biscuits', 'cookies', 'cookie'],
    'dates': ['khajoor', 'khajur'],
    'dry fruits': ['meva', 'nuts', 'almonds', 'cashews'],
    'ragi': ['nachni', 'finger millet', 'ragi porridge'],
}

# Words that must never be treated as food matches
NLP_STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'with', 'without', 'for', 'from',
    'to', 'of', 'in', 'on', 'at', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'him', 'her', 'his', 'he', 'she', 'we', 'they',
    'them', 'their', 'our', 'my', 'me', 'i', 'you', 'only', 'just', 'also',
    'some', 'any', 'all', 'ate', 'eat', 'eaten', 'eating', 'gave', 'give',
    'given', 'today', 'yesterday', 'meal', 'food', 'served', 'serving',
}

# Quantity patterns
QUANTITY_PATTERNS = [
    (r'(\d+)\s*(tbsp|tablespoon|tablespoons)', 'tbsp'),
    (r'(\d+)\s*(tsp|teaspoon|teaspoons)', 'tsp'),
    (r'(\d+)\s*(cup|cups)', 'cup'),
    (r'(\d+)\s*(bowl|bowls|katori)', 'bowl'),
    (r'(\d+)\s*(piece|pieces|pcs)', 'piece'),
    (r'(\d+)\s*(slice|slices)', 'slice'),
    (r'half\s*(a\s*)?', '50%'),
    (r'quarter\s*(a\s*)?', '25%'),
    (r'little|bit|some|thoda', 'small'),
    (r'lot|lots|bahut|zyada', 'large'),
    (r'full|complete|pura|saara', '100%'),
    (r'most|zyada tar', '75%'),
    (r'hardly|barely|mushkil se', '25%'),
    (r'nothing|kuch nahi|ate nothing', '0%'),
]

# Reaction patterns
REACTION_PATTERNS = {
    'loved': [r'loved', r'pyaar', r'favourite', r'favorite', r'best', r'amazing', r'enjoyed a lot'],
    'liked': [r'liked', r'pasand', r'good', r'nice', r'happily', r'enjoyed', r'ate well', r'finished'],
    'neutral': [r'okay', r'theek', r'fine', r'average', r'so-so', r'normal'],
    'disliked': [r'didn\'t like', r'not like', r'made face', r'muh banaya', r'reluctant'],
    'refused': [r'refused', r'reject', r'spit', r'thuk', r'threw', r'didn\'t eat', r'nahi khaya', r'won\'t eat'],
}

# Meal type patterns
MEAL_TYPE_PATTERNS = {
    'breakfast': [r'breakfast', r'morning', r'subah', r'nashta', r'naashta'],
    'mid_morning_snack': [r'mid.?morning', r'11.?am', r'brunch', r'snack.*morning'],
    'lunch': [r'lunch', r'dopahar', r'afternoon meal', r'khana'],
    'evening_snack': [r'evening', r'shaam', r'4.?pm', r'5.?pm', r'tea.?time', r'snack'],
    'dinner': [r'dinner', r'raat', r'night', r'supper'],
}


def normalize_text(text):
    """Normalize text for matching"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def find_foods_in_text(text, food_database=None):
    """
    Extract food mentions from natural language text.
    Uses exact / alias matching with strict fuzzy rules to avoid
    false positives (e.g. 'and' → 'anda'/egg).
    """
    normalized = normalize_text(text)
    found_foods = []
    consumed_spans = set()  # word indices already matched
    
    # Build reverse alias map: alias -> canonical food name
    alias_to_food = {}
    for food, aliases in FOOD_ALIASES.items():
        alias_to_food[food.lower()] = food
        for alias in aliases:
            alias_to_food[alias.lower()] = food
    
    words = normalized.split()
    
    def span_free(start, end):
        return not any(i in consumed_spans for i in range(start, end))
    
    def mark_span(start, end):
        for i in range(start, end):
            consumed_spans.add(i)
    
    # 1) Exact alias matches (longest first)
    for n in range(4, 0, -1):
        for i in range(len(words) - n + 1):
            if not span_free(i, i + n):
                continue
            phrase = ' '.join(words[i:i + n])
            if phrase in NLP_STOP_WORDS:
                continue
            if phrase in alias_to_food:
                found_foods.append({
                    'name': alias_to_food[phrase].title(),
                    'matched_text': phrase,
                    'confidence': 0.95 if n == 1 else 0.98
                })
                mark_span(i, i + n)
    
    # 2) Strict fuzzy match only for unmatched tokens of length >= 4
    #    Never fuzzy-match stop words or very short tokens
    for i, word in enumerate(words):
        if i in consumed_spans:
            continue
        if word in NLP_STOP_WORDS or len(word) < 4:
            continue
        
        best = None
        best_score = 0.0
        for alias, food in alias_to_food.items():
            # Only compare similar-length aliases (avoid 'and' ↔ 'anda')
            if abs(len(alias) - len(word)) > 2:
                continue
            if len(alias) < 4:
                continue
            score = SequenceMatcher(None, word, alias).ratio()
            # Require high similarity AND shared character start for short aliases
            if score > best_score and score >= 0.88:
                if word[0] == alias[0] or score >= 0.92:
                    best_score = score
                    best = (food, alias)
        
        if best:
            found_foods.append({
                'name': best[0].title(),
                'matched_text': word,
                'confidence': round(best_score, 2)
            })
            consumed_spans.add(i)
    
    # 3) Match against food database names (whole-word / containment)
    if food_database:
        for food in food_database:
            food_name = food.get('name', '') if isinstance(food, dict) else str(food)
            food_lower = food_name.lower()
            # Skip combo names that contain filler words when checking
            # Use word-boundary style check
            if food_lower in normalized:
                # Prefer matches where food name appears as contiguous phrase
                if not any(f['name'].lower() == food_lower for f in found_foods):
                    # Also skip if only a stop-word part of the name matched via DB
                    # Require the full name phrase
                    found_foods.append({
                        'name': food_name,
                        'matched_text': food_lower,
                        'confidence': 0.90,
                        'food_id': food.get('id') if isinstance(food, dict) else None
                    })
            else:
                # Check significant words from food name (≥4 chars, not stop words)
                significant = [
                    w for w in re.split(r'[\s/+\-]+', food_lower)
                    if len(w) >= 4 and w not in NLP_STOP_WORDS
                ]
                for sig in significant:
                    if re.search(rf'\b{re.escape(sig)}\b', normalized):
                        # Avoid duplicates of same canonical item
                        if not any(
                            f['name'].lower() == food_lower or
                            f['name'].lower() == sig
                            for f in found_foods
                        ):
                            # Only add if this significant word isn't already claimed
                            # as a different food's match
                            already = any(
                                f.get('matched_text', '') == sig for f in found_foods
                            )
                            if not already:
                                found_foods.append({
                                    'name': food_name,
                                    'matched_text': sig,
                                    'confidence': 0.85,
                                    'food_id': food.get('id') if isinstance(food, dict) else None
                                })
                        break
    
    # Remove duplicates, keep highest confidence
    unique_foods = {}
    for food in found_foods:
        name = food['name'].lower()
        if name not in unique_foods or food['confidence'] > unique_foods[name]['confidence']:
            unique_foods[name] = food
    
    return list(unique_foods.values())


def extract_eaten_vs_served(text):
    """
    Detect foods that were only served vs actually eaten.
    E.g. "gave him X, Y, Z. He ate only Y and Z" → eaten={Y,Z}, refused={X}
    Also: "refused the dal but finished the rice" → refused={dal}, eaten={rice}
    """
    normalized = normalize_text(text)
    eaten = set()
    refused = set()
    
    # "ate only X" OR "only ate X"
    only_match = re.search(
        r'(?:(?:ate|eaten|finished|had)\s+only|only\s+(?:ate|eaten|had))\s+(.+?)(?:\.|,|spit|refused|didn|$)',
        normalized
    )
    if only_match:
        only_foods = find_foods_in_text(only_match.group(1))
        eaten = {f['name'].lower() for f in only_foods}
    
    # Patterns for refused / didn't eat (specific foods)
    # Note: normalize_text turns "didn't" → "didn t"
    refuse_match = re.search(
        r"(?:didn\s*t\s+eat|did\s+not\s+eat|refused(?:\s+the)?|skipped|spit(?:\s+out)?(?:\s+the)?)\s+(.+?)(?:\.|,|but|$)",
        normalized
    )
    if refuse_match:
        refused_foods = find_foods_in_text(refuse_match.group(1))
        refused = {f['name'].lower() for f in refused_foods}
    
    # Contrast: "but finished/ate the rice" after a refuse clause
    finish_match = re.search(
        r'but\s+(?:finished|ate(?:\s+all)?|loved)\s+(?:the\s+)?(.+?)(?:\.|$)',
        normalized
    )
    if finish_match:
        finished_foods = find_foods_in_text(finish_match.group(1))
        eaten |= {f['name'].lower() for f in finished_foods}
    
    return eaten, refused


def extract_portion(text):
    """Extract portion/quantity information from text"""
    normalized = normalize_text(text)
    
    for pattern, value in QUANTITY_PATTERNS:
        match = re.search(pattern, normalized)
        if match:
            if '%' in value:
                return {'type': 'percentage', 'value': int(value.replace('%', ''))}
            elif value in ['small', 'large']:
                return {'type': 'size', 'value': value}
            else:
                return {'type': 'amount', 'value': match.group(1) if match.groups() else '1', 'unit': value}
    
    return {'type': 'percentage', 'value': 100}  # Default to full portion


def extract_reaction(text):
    """Extract toddler's reaction from text"""
    normalized = normalize_text(text)
    
    for reaction, patterns in REACTION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, normalized):
                return reaction
    
    return None  # No clear reaction mentioned


def extract_meal_type(text):
    """Extract meal type from text"""
    normalized = normalize_text(text)
    
    for meal_type, patterns in MEAL_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, normalized):
                return meal_type
    
    return None  # No clear meal type mentioned


def parse_meal_input(text, food_database=None):
    """
    Parse natural language meal input into structured data.
    
    Example input: "He had some rice and dal with ghee for lunch, ate about half, loved the rice but didn't like dal"
    
    Returns: {
        'foods': [{'name': 'Rice', 'confidence': 0.95}, ...],
        'portion': {'type': 'percentage', 'value': 50},
        'meal_type': 'lunch',
        'overall_reaction': 'liked',
        'food_reactions': {'Rice': 'loved', 'Dal': 'disliked'},
        'raw_text': '...'
    }
    """
    foods = find_foods_in_text(text, food_database)
    eaten, refused = extract_eaten_vs_served(text)
    
    # Annotate foods with ate/refused based on "ate only" / "refused X" clauses
    food_reactions = {}
    for food in foods:
        name_lower = food['name'].lower()
        if eaten and name_lower in eaten:
            food['eaten'] = True
            food_reactions[food['name']] = 'liked'
        elif refused and name_lower in refused:
            food['eaten'] = False
            food_reactions[food['name']] = 'refused'
        elif eaten and name_lower not in eaten:
            # "ate only X" implies other mentioned foods were refused
            food['eaten'] = False
            food_reactions[food['name']] = 'refused'
    
    result = {
        'foods': foods,
        'portion': extract_portion(text),
        'meal_type': extract_meal_type(text),
        'overall_reaction': extract_reaction(text),
        'food_reactions': food_reactions,
        'raw_text': text
    }
    
    # Try to extract per-food reactions from clause parts (override if stronger signal)
    parts = re.split(r'\b(but|however|though|and|,)\b', text.lower())
    
    for food in result['foods']:
        food_name = food['name'].lower()
        aliases = FOOD_ALIASES.get(food_name, [])
        for part in parts:
            if food_name in part or any(alias in part for alias in aliases):
                reaction = extract_reaction(part)
                if reaction and food['name'] not in food_reactions:
                    result['food_reactions'][food['name']] = reaction
    
    return result


# ==================== FOOD SIMILARITY (Semantic Search) ====================

# Pre-computed food feature vectors (simplified - in production use sentence-transformers)
FOOD_FEATURES = {
    # Features: [texture_soft, texture_crunchy, taste_sweet, taste_savory, temperature_hot, 
    #            is_grain, is_protein, is_dairy, is_fruit, is_vegetable, spice_level]
    
    'Rice': [0.8, 0.0, 0.1, 0.7, 0.8, 1.0, 0.1, 0.0, 0.0, 0.0, 0.0],
    'Roti': [0.6, 0.2, 0.0, 0.8, 0.7, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0],
    'Idli': [0.9, 0.0, 0.1, 0.6, 0.8, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0],
    'Dosa': [0.4, 0.6, 0.0, 0.7, 0.8, 1.0, 0.2, 0.0, 0.0, 0.0, 0.1],
    'Khichdi': [0.9, 0.0, 0.1, 0.8, 0.9, 0.8, 0.3, 0.0, 0.0, 0.1, 0.1],
    'Upma': [0.7, 0.1, 0.0, 0.8, 0.8, 1.0, 0.1, 0.0, 0.0, 0.1, 0.2],
    'Poha': [0.7, 0.1, 0.1, 0.7, 0.7, 1.0, 0.1, 0.0, 0.0, 0.1, 0.2],
    'Oats': [0.8, 0.0, 0.3, 0.5, 0.8, 1.0, 0.2, 0.2, 0.0, 0.0, 0.0],
    'Daliya': [0.7, 0.1, 0.2, 0.6, 0.8, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0],
    
    'Moong Dal': [0.9, 0.0, 0.1, 0.8, 0.9, 0.2, 0.8, 0.0, 0.0, 0.0, 0.1],
    'Toor Dal': [0.8, 0.0, 0.1, 0.8, 0.9, 0.2, 0.8, 0.0, 0.0, 0.0, 0.2],
    'Chole': [0.6, 0.2, 0.1, 0.9, 0.8, 0.2, 0.8, 0.0, 0.0, 0.0, 0.4],
    'Rajma': [0.7, 0.1, 0.1, 0.9, 0.8, 0.2, 0.8, 0.0, 0.0, 0.0, 0.3],
    
    'Banana': [0.9, 0.0, 0.9, 0.0, 0.0, 0.0, 0.1, 0.0, 1.0, 0.0, 0.0],
    'Apple': [0.5, 0.5, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    'Mango': [0.8, 0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    'Papaya': [0.9, 0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    'Chikoo': [0.9, 0.0, 0.9, 0.0, 0.0, 0.0, 0.1, 0.0, 1.0, 0.0, 0.0],
    
    'Milk': [1.0, 0.0, 0.3, 0.3, 0.5, 0.0, 0.3, 1.0, 0.0, 0.0, 0.0],
    'Curd': [0.9, 0.0, 0.2, 0.4, 0.2, 0.0, 0.3, 1.0, 0.0, 0.0, 0.0],
    'Paneer': [0.7, 0.0, 0.1, 0.5, 0.3, 0.0, 0.8, 1.0, 0.0, 0.0, 0.0],
    
    'Carrot': [0.5, 0.5, 0.6, 0.2, 0.3, 0.0, 0.1, 0.0, 0.0, 1.0, 0.0],
    'Sweet Potato': [0.8, 0.0, 0.7, 0.3, 0.7, 0.0, 0.1, 0.0, 0.0, 1.0, 0.0],
    'Potato': [0.8, 0.0, 0.2, 0.6, 0.7, 0.0, 0.1, 0.0, 0.0, 1.0, 0.0],
    'Pumpkin': [0.9, 0.0, 0.6, 0.3, 0.7, 0.0, 0.1, 0.0, 0.0, 1.0, 0.0],
    'Spinach': [0.8, 0.0, 0.0, 0.5, 0.7, 0.0, 0.2, 0.0, 0.0, 1.0, 0.0],
    
    'Egg': [0.7, 0.0, 0.1, 0.7, 0.7, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
}


def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = sum(a * a for a in vec1) ** 0.5
    magnitude2 = sum(b * b for b in vec2) ** 0.5
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0
    
    return dot_product / (magnitude1 * magnitude2)


def find_similar_foods(food_name, top_n=5, exclude_self=True):
    """
    Find foods similar to the given food based on feature vectors.
    """
    if food_name not in FOOD_FEATURES:
        # Try to find partial match
        for key in FOOD_FEATURES:
            if food_name.lower() in key.lower() or key.lower() in food_name.lower():
                food_name = key
                break
        else:
            return []
    
    target_vector = FOOD_FEATURES[food_name]
    similarities = []
    
    for other_food, vector in FOOD_FEATURES.items():
        if exclude_self and other_food == food_name:
            continue
        
        similarity = cosine_similarity(target_vector, vector)
        similarities.append({
            'food': other_food,
            'similarity': round(similarity, 3)
        })
    
    # Sort by similarity descending
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    
    return similarities[:top_n]


def find_foods_by_features(preferences, top_n=5):
    """
    Find foods matching desired features.
    
    preferences: dict like {'soft': True, 'sweet': True, 'hot': False}
    """
    feature_map = {
        'soft': 0, 'crunchy': 1, 'sweet': 2, 'savory': 3, 'hot': 4,
        'grain': 5, 'protein': 6, 'dairy': 7, 'fruit': 8, 'vegetable': 9, 'spicy': 10
    }
    
    scores = []
    
    for food, vector in FOOD_FEATURES.items():
        score = 0
        for pref, value in preferences.items():
            if pref in feature_map:
                idx = feature_map[pref]
                if value:
                    score += vector[idx]
                else:
                    score += (1 - vector[idx])
        
        scores.append({
            'food': food,
            'score': round(score / len(preferences), 3)
        })
    
    scores.sort(key=lambda x: x['score'], reverse=True)
    return scores[:top_n]


# ==================== IMAGE FOOD RECOGNITION (Placeholder) ====================

# This would use TensorFlow.js in the browser or TFLite on mobile
# Here we provide the interface and a mock implementation

INDIAN_FOOD_CLASSES = [
    'rice', 'roti', 'paratha', 'idli', 'dosa', 'upma', 'poha', 'khichdi',
    'dal', 'sambar', 'chole', 'rajma', 'paneer', 'sabzi', 'raita',
    'banana', 'apple', 'mango', 'orange', 'curd', 'milk', 'egg',
    'puri', 'naan', 'biryani', 'pulao', 'halwa', 'kheer'
]


def recognize_food_from_image(image_data):
    """
    Placeholder for image-based food recognition.
    
    In production, this would:
    1. Use TensorFlow.js in browser for web app
    2. Use TFLite on mobile apps
    3. Process image and return predictions
    
    For now, returns a mock response structure.
    """
    # This is a placeholder - actual implementation would use a trained model
    return {
        'status': 'model_not_loaded',
        'message': 'Image recognition requires TensorFlow.js model to be loaded in browser',
        'instructions': {
            'web': 'Load /static/models/food_classifier.json using tf.loadLayersModel()',
            'mobile': 'Use TFLite interpreter with food_classifier.tflite'
        },
        'mock_response': {
            'predictions': [
                {'class': 'rice', 'confidence': 0.85},
                {'class': 'dal', 'confidence': 0.72},
                {'class': 'roti', 'confidence': 0.45}
            ],
            'detected_foods': ['Rice (Cooked)', 'Moong Dal'],
            'portion_estimate': 'medium bowl'
        }
    }


# ==================== COMBINED SMART PARSING ====================

def smart_meal_parser(text=None, image=None, food_database=None):
    """
    Combined parser that can handle:
    - Text input only
    - Image input only
    - Both text and image
    
    Returns unified meal log structure.
    """
    result = {
        'foods': [],
        'portion': {'type': 'percentage', 'value': 100},
        'meal_type': None,
        'overall_reaction': None,
        'food_reactions': {},
        'confidence': 0,
        'source': []
    }
    
    # Process text input
    if text:
        text_result = parse_meal_input(text, food_database)
        result['foods'].extend(text_result['foods'])
        result['portion'] = text_result['portion']
        result['meal_type'] = text_result['meal_type']
        result['overall_reaction'] = text_result['overall_reaction']
        result['food_reactions'] = text_result['food_reactions']
        result['source'].append('text')
    
    # Process image input
    if image:
        image_result = recognize_food_from_image(image)
        if image_result.get('mock_response', {}).get('detected_foods'):
            for food in image_result['mock_response']['detected_foods']:
                if not any(f['name'].lower() == food.lower() for f in result['foods']):
                    result['foods'].append({
                        'name': food,
                        'confidence': 0.8,
                        'source': 'image'
                    })
        result['source'].append('image')
    
    # Calculate overall confidence
    if result['foods']:
        result['confidence'] = sum(f.get('confidence', 0.5) for f in result['foods']) / len(result['foods'])
    
    return result
