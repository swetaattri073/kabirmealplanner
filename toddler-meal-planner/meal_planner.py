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
        
        if existing_plans and not regenerate:
            return self._format_weekly_plan(existing_plans, week_start)
        
        # Delete existing plans if regenerating
        if regenerate:
            for plan in existing_plans:
                self.db.delete(plan)
            self.db.commit()
        
        # Get toddler's schedule
        schedule = toddler.get_recommended_schedule()
        meals = schedule['meals']
        snacks = schedule['snacks']
        all_meal_types = meals + snacks
        
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
        weekly_plan = []
        used_foods = defaultdict(int)  # Track food usage this week
        
        for day in range(7):
            day_date = week_start + timedelta(days=day)
            day_plan = []
            day_nutrition = defaultdict(float)
            
            for meal_type in all_meal_types:
                # Get best food for this meal
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
                    # Create plan entry
                    plan_entry = WeeklyPlan(
                        toddler_id=toddler.id,
                        week_start=week_start,
                        day_of_week=day,
                        meal_type=meal_type,
                        food_id=food['food'].id,
                        alternatives=food.get('alternatives', []),
                        is_generated=True,
                        nutrition_reason=food.get('reason', '')
                    )
                    self.db.add(plan_entry)
                    day_plan.append(plan_entry)
                    
                    # Update tracking
                    used_foods[food['food'].id] += 1
                    serving = food['food'].get_serving_for_age(toddler.age_months)
                    nutrients = food['food'].get_nutrients_for_serving(serving)
                    for k, v in nutrients.items():
                        day_nutrition[k] += v
            
            weekly_plan.extend(day_plan)
        
        self.db.commit()
        
        return self._format_weekly_plan(weekly_plan, week_start)
    
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
                              recent_foods, nutrition_gaps, day_nutrition, used_foods, day_of_week):
        """
        Select the best food for a specific meal slot.
        
        ALGORITHM EXPLANATION:
        1. Filter foods by meal type (breakfast gets grains/dairy, lunch/dinner get full meals)
        2. Score each food based on:
           - Preference score (30%): Foods the toddler likes get higher scores
           - Nutrition gap filling (35%): Foods rich in lacking nutrients score higher
           - Variety (20%): Foods not eaten recently score higher
           - Day balance (15%): Ensures balanced nutrition throughout the day
        3. Health adjustments: 
           - Underweight: Prioritize calorie-dense foods
           - Overweight: Prioritize fiber-rich, lower calorie options
           - Specific conditions: Boost foods with needed nutrients (iron for anemia, etc.)
        4. Return top scoring food with alternatives
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
        
        for food in meal_foods:
            score = 0
            reasons = []
            
            # 1. Preference score (weight: 30%)
            pref_score = preferences.get(food.id, 0)
            # Normalize to 0-10
            pref_normalized = (pref_score + 2) * 2.5
            score += pref_normalized * 0.3
            
            if pref_score >= 1:
                reasons.append("Liked by toddler")
            
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
        
        # Get top choice and alternatives
        top_choice = scored_foods[0]
        alternatives = [f['food'].id for f in scored_foods[1:4]]
        
        return {
            'food': top_choice['food'],
            'score': top_choice['score'],
            'reason': top_choice['reason'],
            'alternatives': alternatives
        }
    
    def _filter_by_meal_type(self, foods, meal_type):
        """Filter foods appropriate for the meal type"""
        
        meal_categories = {
            'breakfast': ['grain', 'dairy', 'fruit', 'combo'],
            'lunch': ['grain', 'dal', 'vegetable', 'protein', 'combo'],
            'dinner': ['grain', 'dal', 'vegetable', 'protein', 'combo'],
            'mid_morning_snack': ['fruit', 'dairy', 'snack'],
            'evening_snack': ['fruit', 'dairy', 'snack', 'grain']
        }
        
        allowed_categories = meal_categories.get(meal_type, list(meal_categories['lunch']))
        
        return [f for f in foods if f.category in allowed_categories]
    
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
            
            days[day_key]['meals'][entry.meal_type] = {
                'id': entry.id,
                'food': entry.food.to_dict() if entry.food else None,
                'alternatives': entry.alternatives,
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
