"""
Meal Planning Algorithm for Toddler Meal Planner
Generates personalized meal plans based on preferences, nutrition, and variety
"""

from datetime import date, timedelta
from collections import defaultdict
import random
from nutrition_engine import NutritionEngine, RDA_BY_AGE, PRIORITY_NUTRIENTS


class MealPlanner:
    """Generates and manages meal plans for toddlers"""
    
    def __init__(self, db_session):
        self.db = db_session
        self.nutrition_engine = NutritionEngine(db_session)
    
    def generate_weekly_plan(self, toddler, week_start=None, regenerate=False):
        """Generate a complete weekly meal plan"""
        from models import Food, FoodPreference, WeeklyPlan, MealLog
        
        if week_start is None:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
        
        # Check if plan already exists
        existing_plans = WeeklyPlan.query.filter(
            WeeklyPlan.toddler_id == toddler.id,
            WeeklyPlan.week_start == week_start
        ).all()
        
        # Get toddler's schedule early to know expected slot count
        schedule = toddler.get_recommended_schedule()
        meals = schedule['meals']
        snacks = schedule['snacks']
        all_meal_types = meals + snacks
        expected_slots = 7 * len(all_meal_types)
        
        # Fully complete existing plan → return as-is
        if existing_plans and not regenerate and len(existing_plans) >= expected_slots:
            return self._format_weekly_plan(existing_plans, week_start)
        
        existing_map = {(p.day_of_week, p.meal_type): p for p in existing_plans}
        
        # Delete existing plans if regenerating
        if regenerate:
            for plan in existing_plans:
                self.db.delete(plan)
            self.db.commit()
            existing_map = {}
            existing_plans = []
        
        # Get suitable foods
        suitable_foods = self._get_suitable_foods(toddler)
        
        # Get preferences
        preferences = self._get_preference_scores(toddler)
        
        # Get recent foods to avoid repetition
        recent_foods = self._get_recent_foods(toddler, days=7)
        
        # Get nutrition gaps
        weekly_nutrition = self.nutrition_engine.get_weekly_nutrition(toddler)
        nutrition_gaps = self._identify_nutrition_gaps(weekly_nutrition)
        
        # Generate plan for each day
        weekly_plan = list(existing_plans) if existing_map else []
        used_foods = defaultdict(int)  # Track food usage this week
        for p in existing_plans:
            if p.food_id:
                used_foods[p.food_id] += 1
        
        for day in range(7):
            day_date = week_start + timedelta(days=day)
            day_plan = []
            day_nutrition = defaultdict(float)
            
            for meal_type in all_meal_types:
                # Keep existing manual/generated slot if present (fill-only mode)
                if (day, meal_type) in existing_map:
                    day_plan.append(existing_map[(day, meal_type)])
                    continue
                
                # For lunch/dinner, generate complete meal (main + carb + side)
                if meal_type in ['lunch', 'dinner']:
                    complete_meal = self._select_complete_meal(
                        toddler=toddler,
                        meal_type=meal_type,
                        suitable_foods=suitable_foods,
                        preferences=preferences,
                        recent_foods=recent_foods,
                        nutrition_gaps=nutrition_gaps,
                        day_nutrition=day_nutrition,
                        used_foods=used_foods,
                        day_of_week=day
                    )
                    
                    if complete_meal:
                        plan_entry = WeeklyPlan(
                            toddler_id=toddler.id,
                            week_start=week_start,
                            day_of_week=day,
                            meal_type=meal_type,
                            food_id=complete_meal['main']['food'].id,
                            alternatives=self._serialize_complete_meal(complete_meal),
                            is_generated=True,
                            nutrition_reason=complete_meal.get('reason', '')
                        )
                        self.db.add(plan_entry)
                        day_plan.append(plan_entry)
                        
                        # Update tracking for all components
                        for component in ['main', 'carb', 'side']:
                            if complete_meal.get(component) and complete_meal[component].get('food'):
                                food_item = complete_meal[component]['food']
                                used_foods[food_item.id] += 1
                                serving = food_item.get_serving_for_age(toddler.age_months)
                                nutrients = food_item.get_nutrients_for_serving(serving)
                                for k, v in nutrients.items():
                                    day_nutrition[k] += v
                else:
                    # For breakfast and snacks, use single food selection
                    food = self._select_food_for_meal(
                        toddler=toddler,
                        meal_type=meal_type,
                        suitable_foods=suitable_foods,
                        preferences=preferences,
                        recent_foods=recent_foods,
                        nutrition_gaps=nutrition_gaps,
                        day_nutrition=day_nutrition,
                        used_foods=used_foods,
                        day_of_week=day
                    )
                    
                    if food:
                        plan_entry = WeeklyPlan(
                            toddler_id=toddler.id,
                            week_start=week_start,
                            day_of_week=day,
                            meal_type=meal_type,
                            food_id=food['food'].id,
                            alternatives={'backup': food.get('backup')},
                            is_generated=True,
                            nutrition_reason=food.get('reason', '')
                        )
                        self.db.add(plan_entry)
                        day_plan.append(plan_entry)
                        
                        used_foods[food['food'].id] += 1
                        serving = food['food'].get_serving_for_age(toddler.age_months)
                        nutrients = food['food'].get_nutrients_for_serving(serving)
                        for k, v in nutrients.items():
                            day_nutrition[k] += v
            
            weekly_plan.extend([p for p in day_plan if p not in weekly_plan])
        
        self.db.commit()
        
        all_plans = WeeklyPlan.query.filter(
            WeeklyPlan.toddler_id == toddler.id,
            WeeklyPlan.week_start == week_start
        ).all()
        return self._format_weekly_plan(all_plans, week_start)
    
    def _get_suitable_foods(self, toddler):
        """Get all foods suitable for this toddler"""
        from models import Food
        
        foods = Food.query.filter(
            Food.suitable_from_months <= toddler.age_months
        ).all()
        
        # Filter by dietary preference and allergens
        suitable = []
        for food in foods:
            # Check allergens
            has_allergen = False
            for allergen in (toddler.allergies or []):
                if allergen in (food.allergens or []):
                    has_allergen = True
                    break
            if has_allergen:
                continue
            
            # Check dietary preference
            if toddler.dietary_preference == 'vegetarian':
                if food.category == 'protein':
                    food_name_lower = food.name.lower()
                    if any(x in food_name_lower for x in ['chicken', 'fish', 'meat', 'mutton']):
                        continue
            elif toddler.dietary_preference == 'eggetarian':
                if food.category == 'protein':
                    food_name_lower = food.name.lower()
                    if any(x in food_name_lower for x in ['chicken', 'fish', 'meat', 'mutton']):
                        continue
            
            suitable.append(food)
        
        return suitable
    
    def _get_preference_scores(self, toddler):
        """Get preference scores for all foods"""
        from models import FoodPreference
        
        prefs = FoodPreference.query.filter_by(toddler_id=toddler.id).all()
        return {p.food_id: p.preference_score for p in prefs}
    
    def _get_recent_foods(self, toddler, days=7):
        """Get foods eaten in recent days"""
        from models import MealLog
        
        cutoff = date.today() - timedelta(days=days)
        logs = MealLog.query.filter(
            MealLog.toddler_id == toddler.id,
            MealLog.date >= cutoff,
            MealLog.food_id.isnot(None)
        ).all()
        
        recent = defaultdict(int)
        for log in logs:
            recent[log.food_id] += 1
        
        return recent
    
    def _identify_nutrition_gaps(self, weekly_nutrition):
        """Identify which nutrients are below target"""
        gaps = {}
        weekly_status = weekly_nutrition.get('weekly_status', {})
        
        for nutrient in PRIORITY_NUTRIENTS:
            status = weekly_status.get(nutrient, {})
            percentage = status.get('percentage', 100)
            
            if percentage < 100:
                # Gap severity: how much below target
                gaps[nutrient] = 100 - percentage
        
        return gaps
    
    def _select_food_for_meal(self, toddler, meal_type, suitable_foods, preferences, 
                              recent_foods, nutrition_gaps, day_nutrition, used_foods, day_of_week,
                              include_reexposure=True):
        """
        Select the best food for a specific meal slot.
        
        ALGORITHM EXPLANATION:
        1. Filter foods by meal type (breakfast gets grains/dairy, lunch/dinner get full meals)
        2. Score each food based on:
           - Preference score (25%): Foods the toddler likes get higher scores
           - Nutrition gap filling (35%): Foods rich in lacking nutrients score higher
           - Variety (20%): Foods not eaten recently score higher
           - Day balance (10%): Ensures balanced nutrition throughout the day
           - Re-exposure bonus (10%): Occasionally include previously refused foods
        3. Health adjustments: 
           - Underweight: Prioritize calorie-dense foods
           - Overweight: Prioritize fiber-rich, lower calorie options
           - Specific conditions: Boost foods with needed nutrients (iron for anemia, etc.)
        4. IMPORTANT: We DON'T remove refused foods - research shows 10-15 exposures 
           are needed for acceptance. Instead, we schedule them occasionally alongside 
           accepted foods to encourage gradual acceptance.
        5. Return top scoring food with alternatives
        """
        
        # Filter foods appropriate for meal type
        meal_foods = self._filter_by_meal_type(suitable_foods, meal_type)
        
        if not meal_foods:
            return None
        
        # Score each food
        scored_foods = []
        rda = self.nutrition_engine.get_rda(toddler.age_months, toddler)  # Adjusted RDA
        
        # Get health-based priorities
        nutrition_priorities = toddler.get_nutrition_priorities()
        weight_status = toddler.get_weight_status()
        calorie_adjustment = toddler.get_calorie_adjustment()
        
        # Get foods that need re-exposure (previously refused but not offered recently)
        from models import FoodPreference
        reexposure_foods = set()
        if include_reexposure:
            prefs = FoodPreference.query.filter_by(toddler_id=toddler.id).all()
            for pref in prefs:
                if pref.needs_reexposure():
                    reexposure_foods.add(pref.food_id)
        
        for food in meal_foods:
            score = 0
            reasons = []
            
            # 1. Preference score (weight: 25%)
            pref_score = preferences.get(food.id, 0)
            # Normalize to 0-10, but don't heavily penalize negative scores
            # This ensures refused foods still appear occasionally
            pref_normalized = (max(pref_score, -0.5) + 2) * 2.5
            score += pref_normalized * 0.25
            
            if pref_score >= 1:
                reasons.append("Liked by toddler")
            
            # 1b. Re-exposure bonus (weight: 10%)
            # Give bonus to foods that need more exposure attempts
            if food.id in reexposure_foods:
                # Add to 1-2 meals per week for re-exposure
                # Only add if this is the right day (spread across week)
                if day_of_week % 3 == 0:  # Every 3rd day
                    score += 5 * 0.10
                    reasons.append("Re-exposure (building acceptance)")
            
            # 2. Nutrition gap filling (weight: 35%)
            nutrition_score = 0
            serving = food.get_serving_for_age(toddler.age_months)
            food_nutrients = food.get_nutrients_for_serving(serving)
            
            for nutrient, gap in nutrition_gaps.items():
                nutrient_value = food_nutrients.get(nutrient, 0)
                rda_value = rda.get(nutrient, 1)
                
                if rda_value > 0:
                    contribution = (nutrient_value / rda_value) * 100
                    gap_score = min(contribution * (gap / 100), 10)
                    
                    # Boost score for priority nutrients (health-based)
                    if nutrient in nutrition_priorities:
                        gap_score *= 1.5
                    
                    nutrition_score += gap_score
                    
                    if contribution > 20:
                        from nutrition_engine import NUTRIENT_INFO
                        nutrient_name = NUTRIENT_INFO.get(nutrient, {}).get('name', nutrient)
                        reasons.append(f"Good source of {nutrient_name}")
            
            score += min(nutrition_score, 15) * 0.35
            
            # 2b. Health-based adjustments
            if weight_status in ['severely_underweight', 'underweight']:
                # Prioritize calorie-dense foods
                if food_nutrients.get('calories', 0) > 150:
                    score += 3
                    reasons.append("High calorie for weight gain")
                if food_nutrients.get('fat_g', 0) > 5:
                    score += 1
            elif weight_status in ['overweight', 'obese']:
                # Prioritize lower calorie, high fiber foods
                if food_nutrients.get('fiber_g', 0) > 2:
                    score += 2
                if food_nutrients.get('calories', 0) < 100:
                    score += 1
            
            # 3. Variety penalty (weight: 20%)
            variety_penalty = 0
            times_used_week = used_foods.get(food.id, 0)
            times_recent = recent_foods.get(food.id, 0)
            
            if times_used_week > 0:
                variety_penalty += times_used_week * 2
            if times_recent > 0:
                variety_penalty += times_recent
            
            variety_score = max(0, 10 - variety_penalty)
            score += variety_score * 0.2
            
            if times_used_week == 0 and times_recent == 0:
                reasons.append("New this week")
            
            # 4. Day balance (weight: 15%)
            # Ensure each meal has balanced nutrition
            balance_score = 5
            current_calories = day_nutrition.get('calories', 0)
            current_protein = day_nutrition.get('protein_g', 0)
            
            daily_rda = rda.get('calories', 1000)
            if current_calories < daily_rda * 0.8:
                if food_nutrients.get('calories', 0) > 50:
                    balance_score += 2
            
            score += balance_score * 0.15
            
            # Add randomness for variety (small factor)
            score += random.uniform(0, 1)
            
            scored_foods.append({
                'food': food,
                'score': score,
                'reason': reasons[0] if reasons else "Balanced option"
            })
        
        # Sort by score
        scored_foods.sort(key=lambda x: x['score'], reverse=True)
        
        if not scored_foods:
            return None
        
        # Get top choice and 1 backup alternative
        top_choice = scored_foods[0]
        
        # Get 1 backup from a different category if possible
        backup = None
        for item in scored_foods[1:5]:
            if item['food'].category != top_choice['food'].category:
                backup = {
                    'food_id': item['food'].id,
                    'food_name': item['food'].name,
                    'category': item['food'].category,
                    'reason': item['reason']
                }
                break
        
        # If no different category found, just take the second best
        if not backup and len(scored_foods) > 1:
            item = scored_foods[1]
            backup = {
                'food_id': item['food'].id,
                'food_name': item['food'].name,
                'category': item['food'].category,
                'reason': item['reason']
            }
        
        return {
            'food': top_choice['food'],
            'score': top_choice['score'],
            'reason': top_choice['reason'],
            'backup': backup  # Single backup option
        }
    
    def _select_complete_meal(self, toddler, meal_type, suitable_foods, preferences,
                              recent_foods, nutrition_gaps, day_nutrition, used_foods, day_of_week):
        """
        Select a complete lunch/dinner meal with:
        - Main dish (sabji/curry/dal)
        - Carb (roti/rice)
        - Side (salad/dahi)
        - Nutritious add-ins
        """
        
        # Categorize foods
        main_dishes = []  # Dal, sabzi, curry, protein
        carbs = []        # Roti, rice
        sides = []        # Dahi, salad, raita
        
        for food in suitable_foods:
            name_lower = food.name.lower()
            
            # Main dishes: dal, sabzi, curry, paneer dishes, protein
            if food.category in ['dal', 'vegetable', 'protein']:
                main_dishes.append(food)
            elif food.category == 'combo' and any(kw in name_lower for kw in ['paneer', 'sabzi', 'curry', 'aloo', 'gobi']):
                main_dishes.append(food)
            
            # Carbs: roti, rice, paratha (plain)
            elif food.category == 'grain':
                if any(kw in name_lower for kw in ['rice', 'roti', 'chapati', 'paratha', 'phulka']):
                    carbs.append(food)
            
            # Sides: curd, raita, salad
            elif food.category == 'dairy' and any(kw in name_lower for kw in ['curd', 'yogurt', 'dahi', 'raita', 'lassi']):
                sides.append(food)
        
        # Add cucumber/tomato as salad options if available
        for food in suitable_foods:
            if food.category == 'vegetable' and any(kw in food.name.lower() for kw in ['cucumber', 'tomato', 'salad']):
                sides.append(food)
        
        # If no dedicated sides, use curd from dairy
        if not sides:
            for food in suitable_foods:
                if food.category == 'dairy' and 'curd' in food.name.lower():
                    sides.append(food)
                    break
        
        # Score and select each component
        def score_food(food):
            score = 0
            pref_score = preferences.get(food.id, 0)
            score += (max(pref_score, -0.5) + 2) * 2.5 * 0.3  # Preference 30%
            
            # Nutrition gap filling
            serving = food.get_serving_for_age(toddler.age_months)
            food_nutrients = food.get_nutrients_for_serving(serving)
            for nutrient, gap in nutrition_gaps.items():
                nutrient_value = food_nutrients.get(nutrient, 0)
                rda_value = self.nutrition_engine.get_rda(toddler.age_months).get(nutrient, 1)
                if rda_value > 0:
                    contribution = (nutrient_value / rda_value) * 100
                    score += min(contribution * (gap / 100), 5) * 0.4  # Nutrition 40%
            
            # Variety penalty
            times_used = used_foods.get(food.id, 0) + recent_foods.get(food.id, 0)
            score -= times_used * 2  # Penalty for repetition
            
            # Random factor for variety
            score += random.uniform(0, 1)
            
            return score
        
        # Select best main dish
        if main_dishes:
            main_dishes_scored = [(f, score_food(f)) for f in main_dishes]
            main_dishes_scored.sort(key=lambda x: x[1], reverse=True)
            selected_main = main_dishes_scored[0][0]
            backup_main = main_dishes_scored[1][0] if len(main_dishes_scored) > 1 else None
        else:
            return None
        
        # Select carb (alternate between roti and rice)
        if carbs:
            # Prefer variety - if yesterday was rice, suggest roti today
            rice_options = [f for f in carbs if 'rice' in f.name.lower()]
            roti_options = [f for f in carbs if any(kw in f.name.lower() for kw in ['roti', 'chapati', 'paratha', 'phulka'])]
            
            # Alternate based on day
            if day_of_week % 2 == 0 and roti_options:
                selected_carb = random.choice(roti_options)
            elif rice_options:
                selected_carb = random.choice(rice_options)
            else:
                selected_carb = carbs[0]
        else:
            selected_carb = None
        
        # Select side
        if sides:
            selected_side = random.choice(sides)
        else:
            selected_side = None
        
        # Generate nutritious add-in suggestions
        add_ins = self._get_nutritious_addins(toddler, nutrition_gaps, selected_main, selected_carb, selected_side)
        
        # Create complete meal structure
        complete_meal = {
            'main': {
                'food': selected_main,
                'food_id': selected_main.id,
                'food_name': selected_main.name,
                'category': selected_main.category
            },
            'carb': {
                'food': selected_carb,
                'food_id': selected_carb.id if selected_carb else None,
                'food_name': selected_carb.name if selected_carb else 'Roti/Rice',
                'category': 'grain'
            } if selected_carb else None,
            'side': {
                'food': selected_side,
                'food_id': selected_side.id if selected_side else None,
                'food_name': selected_side.name if selected_side else 'Dahi/Salad',
                'category': selected_side.category if selected_side else 'dairy'
            } if selected_side else None,
            'add_ins': add_ins,
            'backup': {
                'main': {
                    'food_id': backup_main.id,
                    'food_name': backup_main.name
                } if backup_main else None
            },
            'reason': f"Balanced {meal_type} with {selected_main.name}"
        }
        
        return complete_meal
    
    def _serialize_complete_meal(self, complete_meal):
        """Remove ORM Food objects so alternatives can be stored as JSON."""
        if not complete_meal:
            return None
        
        def component(comp):
            if not comp:
                return None
            return {
                'food_id': comp.get('food_id'),
                'food_name': comp.get('food_name'),
                'category': comp.get('category'),
            }
        
        return {
            'main': component(complete_meal.get('main')),
            'carb': component(complete_meal.get('carb')),
            'side': component(complete_meal.get('side')),
            'add_ins': complete_meal.get('add_ins', []),
            'backup': complete_meal.get('backup'),
            'reason': complete_meal.get('reason', ''),
        }
    
    def _get_nutritious_addins(self, toddler, nutrition_gaps, main, carb, side):
        """Suggest nutritious add-ins based on gaps"""
        add_ins = []
        
        # Common nutritious add-ins
        addin_suggestions = {
            'iron_mg': [
                {'name': 'Jaggery powder', 'add_to': 'dahi or roti', 'benefit': 'Boosts iron'},
                {'name': 'Spinach puree', 'add_to': 'dal or roti dough', 'benefit': 'Iron rich'},
                {'name': 'Dates (chopped)', 'add_to': 'dahi', 'benefit': 'Iron & energy'}
            ],
            'calcium_mg': [
                {'name': 'Sesame seeds (til)', 'add_to': 'roti dough or salad', 'benefit': 'High calcium'},
                {'name': 'Paneer cubes', 'add_to': 'any sabji', 'benefit': 'Calcium & protein'},
                {'name': 'Curd/Dahi', 'add_to': 'serve alongside', 'benefit': 'Calcium rich'}
            ],
            'protein_g': [
                {'name': 'Paneer crumbles', 'add_to': 'sabji or paratha', 'benefit': 'Extra protein'},
                {'name': 'Curd', 'add_to': 'serve with meal', 'benefit': 'Protein & probiotics'},
                {'name': 'Moong dal paste', 'add_to': 'roti dough', 'benefit': 'Protein boost'}
            ],
            'vitamin_a_mcg': [
                {'name': 'Carrot (grated)', 'add_to': 'salad or raita', 'benefit': 'Vitamin A'},
                {'name': 'Ghee (small amount)', 'add_to': 'roti or dal', 'benefit': 'Helps absorb vitamins'}
            ],
            'fiber_g': [
                {'name': 'Cucumber/Tomato salad', 'add_to': 'serve alongside', 'benefit': 'Fiber & hydration'},
                {'name': 'Methi leaves', 'add_to': 'roti dough', 'benefit': 'Fiber & iron'}
            ]
        }
        
        # Add suggestions for top 2 nutritional gaps
        gaps_sorted = sorted(nutrition_gaps.items(), key=lambda x: x[1], reverse=True)[:2]
        
        for nutrient, gap in gaps_sorted:
            if nutrient in addin_suggestions and gap > 20:
                suggestion = random.choice(addin_suggestions[nutrient])
                add_ins.append(suggestion)
        
        # Always suggest at least one add-in
        if not add_ins:
            add_ins.append({'name': 'Ghee', 'add_to': 'roti or rice', 'benefit': 'Healthy fats & taste'})
        
        return add_ins[:2]  # Max 2 add-ins
    
    def _filter_by_meal_type(self, foods, meal_type):
        """Filter foods appropriate for the meal type with strict separation"""
        
        # Define breakfast-specific foods (should NOT include dal-based items)
        breakfast_keywords = ['idli', 'dosa', 'upma', 'poha', 'paratha', 'roti', 'toast', 
                             'cereal', 'oats', 'porridge', 'cheela', 'uttapam', 'sandwich']
        
        # Foods that are strictly lunch/dinner (should NEVER appear in breakfast)
        lunch_dinner_keywords = ['dal', 'rice', 'sabzi', 'curry', 'rajma', 'chole', 
                                 'sambar', 'rasam', 'pulao', 'biryani', 'khichdi']
        
        # Accompaniments that need to be paired (not standalone meals)
        accompaniment_foods = ['cheese', 'ghee', 'butter', 'curd', 'yogurt', 'chutney', 'pickle']
        
        if meal_type == 'breakfast':
            filtered = []
            for f in foods:
                name_lower = f.name.lower()
                
                # Skip lunch/dinner items
                if any(kw in name_lower for kw in lunch_dinner_keywords):
                    continue
                
                # Skip standalone accompaniments for main meal slot
                if any(kw in name_lower for kw in accompaniment_foods):
                    continue
                
                # Include breakfast grains and combos
                if f.category in ['grain', 'combo']:
                    # Prefer breakfast-appropriate items
                    if any(kw in name_lower for kw in breakfast_keywords):
                        filtered.append(f)
                    elif f.category == 'grain':
                        filtered.append(f)
                
                # Include fruits for breakfast
                elif f.category == 'fruit':
                    filtered.append(f)
                
                # Include eggs for breakfast
                elif f.category == 'protein' and 'egg' in name_lower:
                    filtered.append(f)
            
            return filtered
        
        elif meal_type in ['lunch', 'dinner']:
            filtered = []
            for f in foods:
                name_lower = f.name.lower()
                
                # Skip standalone accompaniments
                if any(kw in name_lower for kw in accompaniment_foods):
                    continue
                
                # Include main meal categories
                if f.category in ['grain', 'dal', 'vegetable', 'protein', 'combo']:
                    filtered.append(f)
            
            return filtered
        
        elif 'snack' in meal_type:
            # Snacks can include fruits, dairy (including cheese), and snack items
            return [f for f in foods if f.category in ['fruit', 'dairy', 'snack']]
        
        # Default
        return foods
    
    def _format_weekly_plan(self, plan_entries, week_start):
        """Format weekly plan for API response"""
        
        # Group by day
        days = defaultdict(lambda: defaultdict(dict))
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        for entry in plan_entries:
            day_date = week_start + timedelta(days=entry.day_of_week)
            day_key = day_date.isoformat()
            
            days[day_key]['date'] = day_date.isoformat()
            days[day_key]['day_name'] = day_names[entry.day_of_week]
            days[day_key]['day_of_week'] = entry.day_of_week
            
            if 'meals' not in days[day_key]:
                days[day_key]['meals'] = {}
            
            # Check if this is a complete meal (lunch/dinner) or single food
            if entry.meal_type in ['lunch', 'dinner'] and isinstance(entry.alternatives, dict) and 'main' in entry.alternatives:
                # Complete meal format
                complete_meal = entry.alternatives
                
                # Format the complete meal for response
                meal_data = {
                    'id': entry.id,
                    'is_complete_meal': True,
                    'main': {
                        'food': entry.food.to_dict() if entry.food else None,
                        'food_name': complete_meal.get('main', {}).get('food_name', '')
                    },
                    'carb': complete_meal.get('carb'),
                    'side': complete_meal.get('side'),
                    'add_ins': complete_meal.get('add_ins', []),
                    'backup': complete_meal.get('backup'),
                    'reason': entry.nutrition_reason,
                    'is_generated': entry.is_generated,
                    # Summary for display
                    'summary': self._format_meal_summary(complete_meal)
                }
                
                # Remove food objects from nested structures (not JSON serializable)
                if meal_data['carb'] and 'food' in meal_data['carb']:
                    del meal_data['carb']['food']
                if meal_data['side'] and 'food' in meal_data['side']:
                    del meal_data['side']['food']
                
                days[day_key]['meals'][entry.meal_type] = meal_data
            else:
                # Single food format (breakfast, snacks)
                backup = None
                if isinstance(entry.alternatives, dict) and 'backup' in entry.alternatives:
                    backup = entry.alternatives.get('backup')
                elif isinstance(entry.alternatives, list) and entry.alternatives:
                    backup = entry.alternatives[0] if entry.alternatives else None
                
                days[day_key]['meals'][entry.meal_type] = {
                    'id': entry.id,
                    'is_complete_meal': False,
                    'food': entry.food.to_dict() if entry.food else None,
                    'backup': backup,
                    'reason': entry.nutrition_reason,
                    'is_generated': entry.is_generated
                }
        
        # Sort by day
        sorted_days = sorted(days.values(), key=lambda x: x['day_of_week'])
        
        return {
            'week_start': week_start.isoformat(),
            'week_end': (week_start + timedelta(days=6)).isoformat(),
            'days': sorted_days
        }
    
    def _format_meal_summary(self, complete_meal):
        """Create a readable summary of a complete meal"""
        parts = []
        
        if complete_meal.get('main'):
            parts.append(complete_meal['main'].get('food_name', 'Main dish'))
        
        if complete_meal.get('carb'):
            parts.append(complete_meal['carb'].get('food_name', 'Roti/Rice'))
        
        if complete_meal.get('side'):
            parts.append(complete_meal['side'].get('food_name', 'Dahi'))
        
        summary = ' + '.join(parts)
        
        # Add add-ins hint
        if complete_meal.get('add_ins'):
            addin_names = [a['name'] for a in complete_meal['add_ins'][:2]]
            summary += f" (add: {', '.join(addin_names)})"
        
        return summary
    
    def update_plan_item(self, plan_id, new_food_id, is_manual=True):
        """Update a specific meal in the plan"""
        from models import WeeklyPlan, Food
        
        plan = WeeklyPlan.query.get(plan_id)
        if not plan:
            return None
        
        food = Food.query.get(new_food_id)
        if not food:
            return None
        
        plan.food_id = new_food_id
        plan.is_generated = not is_manual
        plan.nutrition_reason = "Manually selected" if is_manual else plan.nutrition_reason
        
        self.db.commit()
        
        return plan.to_dict()
    
    def get_daily_suggestions(self, toddler, target_date=None):
        """Get meal suggestions for today based on current nutrition status"""
        from models import Food
        
        if target_date is None:
            target_date = date.today()
        
        # Get current nutrition status
        nutrition_status = self.nutrition_engine.get_nutrition_status(toddler, target_date)
        
        # Identify what's been eaten today
        from models import MealLog
        today_logs = MealLog.query.filter(
            MealLog.toddler_id == toddler.id,
            MealLog.date == target_date
        ).all()
        
        eaten_meals = set()
        for log in today_logs:
            eaten_meals.add(log.meal_type)
        
        # Get schedule
        schedule = toddler.get_recommended_schedule()
        all_meals = schedule['meals'] + schedule['snacks']
        
        # Find remaining meals
        remaining_meals = [m for m in all_meals if m not in eaten_meals]
        
        # Get suggestions for each remaining meal
        suggestions = {}
        for meal_type in remaining_meals:
            meal_suggestions = self.nutrition_engine.get_food_suggestions_for_meal(
                toddler, 
                meal_type,
                {k: v['actual'] for k, v in nutrition_status.items()}
            )
            suggestions[meal_type] = meal_suggestions
        
        return {
            'date': target_date.isoformat(),
            'nutrition_status': nutrition_status,
            'eaten_meals': list(eaten_meals),
            'remaining_meals': remaining_meals,
            'suggestions': suggestions
        }


def update_preferences_from_log(db_session, meal_log):
    """Update food preferences based on a meal log entry"""
    from models import FoodPreference
    
    if not meal_log.food_id or not meal_log.toddler_reaction:
        return None
    
    # Get or create preference
    pref = FoodPreference.query.filter_by(
        toddler_id=meal_log.toddler_id,
        food_id=meal_log.food_id
    ).first()
    
    if not pref:
        pref = FoodPreference(
            toddler_id=meal_log.toddler_id,
            food_id=meal_log.food_id,
            preference_score=0,
            times_offered=0,
            times_accepted=0
        )
        db_session.add(pref)
    
    # Update based on reaction
    pref.update_from_reaction(meal_log.toddler_reaction)
    db_session.commit()
    
    return pref
