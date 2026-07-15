"""
Nutrition Engine for Toddler Meal Planner
Handles RDA calculations, deficiency detection, and meal suggestions
Based on Indian RDA (NIN - National Institute of Nutrition) guidelines
"""

import re
from datetime import date, timedelta
from collections import defaultdict


# Recommended Daily Allowances for Indian toddlers
# Source: ICMR-NIN Dietary Guidelines for Indians (2020)
RDA_BY_AGE = {
    '6-12_months': {
        'calories': 720,  # kcal (includes breastmilk)
        'protein_g': 10,
        'fat_g': 30,  # ~40% of calories from fat
        'carbs_g': 95,
        'fiber_g': 5,
        'calcium_mg': 500,
        'iron_mg': 5,  # Lower due to breastmilk iron
        'zinc_mg': 2.8,
        'vitamin_a_mcg': 350,
        'vitamin_c_mg': 25,
        'vitamin_d_mcg': 10,  # 400 IU
        'vitamin_b12_mcg': 0.5,
        'folate_mcg': 80,
    },
    '12-24_months': {
        'calories': 1060,
        'protein_g': 12,
        'fat_g': 35,
        'carbs_g': 130,
        'fiber_g': 10,
        'calcium_mg': 500,
        'iron_mg': 9,
        'zinc_mg': 3,
        'vitamin_a_mcg': 400,
        'vitamin_c_mg': 40,
        'vitamin_d_mcg': 10,
        'vitamin_b12_mcg': 0.9,
        'folate_mcg': 120,
    },
    '24-36_months': {
        'calories': 1240,
        'protein_g': 15,
        'fat_g': 40,
        'carbs_g': 160,
        'fiber_g': 12,
        'calcium_mg': 600,
        'iron_mg': 9,
        'zinc_mg': 3,
        'vitamin_a_mcg': 400,
        'vitamin_c_mg': 40,
        'vitamin_d_mcg': 10,
        'vitamin_b12_mcg': 0.9,
        'folate_mcg': 150,
    },
    '36+_months': {
        'calories': 1360,
        'protein_g': 18,
        'fat_g': 45,
        'carbs_g': 180,
        'fiber_g': 15,
        'calcium_mg': 600,
        'iron_mg': 13,  # Higher for preschoolers
        'zinc_mg': 5,
        'vitamin_a_mcg': 450,
        'vitamin_c_mg': 40,
        'vitamin_d_mcg': 10,
        'vitamin_b12_mcg': 1.2,
        'folate_mcg': 200,
    }
}

# Nutrient names and units for display
NUTRIENT_INFO = {
    'calories': {'name': 'Energy', 'unit': 'kcal', 'icon': '🔥'},
    'protein_g': {'name': 'Protein', 'unit': 'g', 'icon': '💪'},
    'fat_g': {'name': 'Fat', 'unit': 'g', 'icon': '🧈'},
    'carbs_g': {'name': 'Carbohydrates', 'unit': 'g', 'icon': '🍚'},
    'fiber_g': {'name': 'Fiber', 'unit': 'g', 'icon': '🥬'},
    'calcium_mg': {'name': 'Calcium', 'unit': 'mg', 'icon': '🦴'},
    'iron_mg': {'name': 'Iron', 'unit': 'mg', 'icon': '🩸'},
    'zinc_mg': {'name': 'Zinc', 'unit': 'mg', 'icon': '⚡'},
    'vitamin_a_mcg': {'name': 'Vitamin A', 'unit': 'mcg', 'icon': '👁️'},
    'vitamin_c_mg': {'name': 'Vitamin C', 'unit': 'mg', 'icon': '🍊'},
    'vitamin_d_mcg': {'name': 'Vitamin D', 'unit': 'mcg', 'icon': '☀️'},
    'vitamin_b12_mcg': {'name': 'Vitamin B12', 'unit': 'mcg', 'icon': '🔴'},
    'folate_mcg': {'name': 'Folate', 'unit': 'mcg', 'icon': '🧬'},
}

# Priority nutrients to track (in order of importance for Indian toddlers)
PRIORITY_NUTRIENTS = [
    'iron_mg',      # #1 concern for Indian vegetarian diets
    'protein_g',
    'calcium_mg',
    'vitamin_d_mcg',
    'vitamin_b12_mcg',
    'zinc_mg',
    'vitamin_a_mcg',
]

# Food recommendations for each nutrient deficiency
NUTRIENT_FOOD_RECOMMENDATIONS = {
    'iron_mg': {
        'message': 'Iron is crucial for brain development and preventing anemia.',
        'veg_foods': ['Ragi/Finger Millet Porridge', 'Spinach/Palak', 'Dates', 'Moong Dal', 'Masoor Dal', 'Jaggery', 'Beetroot'],
        'non_veg_foods': ['Egg (Boiled)', 'Chicken (Boneless)', 'Fish (Rohu/Pomfret)'],
        'tips': [
            'Pair iron-rich foods with Vitamin C sources (orange, tomato) for better absorption',
            'Avoid giving milk/dairy with iron-rich meals - calcium blocks iron absorption',
            'Cook in iron kadai/pan to increase iron content'
        ]
    },
    'protein_g': {
        'message': 'Protein is essential for growth and muscle development.',
        'veg_foods': ['Paneer', 'Moong Dal', 'Toor Dal', 'Chole/Chickpeas', 'Rajma (Kidney Beans)', 'Milk (Whole)', 'Curd/Yogurt', 'Besan Chilla'],
        'non_veg_foods': ['Egg (Boiled)', 'Chicken (Boneless)', 'Fish (Rohu/Pomfret)'],
        'tips': [
            'Combine dal + rice for complete protein',
            'Add paneer to vegetables for extra protein',
            'Dry fruits powder in milk boosts protein'
        ]
    },
    'calcium_mg': {
        'message': 'Calcium is vital for strong bones and teeth.',
        'veg_foods': ['Milk (Whole)', 'Curd/Yogurt', 'Paneer', 'Cheese', 'Ragi/Finger Millet Porridge', 'Spinach/Palak'],
        'non_veg_foods': ['Fish (Rohu/Pomfret)'],
        'tips': [
            'Ragi is the best non-dairy calcium source',
            'Morning sunlight helps Vitamin D which aids calcium absorption',
            'Avoid excess salt which causes calcium loss'
        ]
    },
    'vitamin_d_mcg': {
        'message': 'Vitamin D helps absorb calcium and supports immunity.',
        'veg_foods': ['Milk (Whole)', 'Ghee'],
        'non_veg_foods': ['Egg (Boiled)', 'Fish (Rohu/Pomfret)'],
        'tips': [
            '10-15 minutes of morning sunlight (before 10am) is the best source',
            'Most Indian toddlers are Vitamin D deficient - consider supplements after consulting doctor',
            'Fortified milk can help'
        ]
    },
    'vitamin_b12_mcg': {
        'message': 'Vitamin B12 is crucial for brain development and nervous system.',
        'veg_foods': ['Milk (Whole)', 'Curd/Yogurt', 'Paneer', 'Cheese'],
        'non_veg_foods': ['Egg (Boiled)', 'Chicken (Boneless)', 'Fish (Rohu/Pomfret)'],
        'tips': [
            'B12 is mainly found in animal products - vegetarian toddlers may need supplements',
            'Fermented foods like dahi/idli have some B12',
            'Consult pediatrician for B12 supplementation'
        ]
    },
    'zinc_mg': {
        'message': 'Zinc supports immune function and growth.',
        'veg_foods': ['Pumpkin', 'Chickpeas', 'Lentils', 'Cheese', 'Oats Porridge', 'Dry Fruits Mix (soaked)'],
        'non_veg_foods': ['Egg (Boiled)', 'Chicken (Boneless)'],
        'tips': [
            'Soaking and sprouting dals increases zinc availability',
            'Pumpkin seeds are excellent zinc source (grind for toddlers)',
            'Zinc from animal sources is better absorbed'
        ]
    },
    'vitamin_a_mcg': {
        'message': 'Vitamin A is important for vision, skin and immune health.',
        'veg_foods': ['Carrot', 'Sweet Potato', 'Pumpkin', 'Spinach/Palak', 'Mango', 'Papaya', 'Ghee'],
        'non_veg_foods': ['Egg (Boiled)'],
        'tips': [
            'Orange and dark green vegetables are rich in Vitamin A',
            'Fat helps absorb Vitamin A - add ghee to vegetables',
            'Sweet potato is an excellent Vitamin A source'
        ]
    },
    'vitamin_c_mg': {
        'message': 'Vitamin C boosts immunity and helps iron absorption.',
        'veg_foods': ['Orange', 'Papaya', 'Tomato', 'Cauliflower', 'Mango', 'Peas'],
        'non_veg_foods': [],
        'tips': [
            'Give citrus fruits with iron-rich meals',
            'Vitamin C is destroyed by heat - serve fruits fresh',
            'Amla (Indian gooseberry) is extremely rich in Vitamin C'
        ]
    },
    'folate_mcg': {
        'message': 'Folate is essential for cell growth and development.',
        'veg_foods': ['Spinach/Palak', 'Moong Dal', 'Masoor Dal', 'Beetroot', 'Peanuts (Roasted)', 'Orange'],
        'non_veg_foods': ['Egg (Boiled)'],
        'tips': [
            'Dark leafy greens are excellent folate sources',
            'Don\'t overcook vegetables - it destroys folate',
            'Most dals are good folate sources'
        ]
    },
    'fiber_g': {
        'message': 'Fiber aids digestion and prevents constipation.',
        'veg_foods': ['Daliya/Broken Wheat Porridge', 'Oats Porridge', 'Peas', 'Carrot', 'Apple', 'Banana'],
        'non_veg_foods': [],
        'tips': [
            'Increase fiber gradually to prevent gas',
            'Give plenty of water with fiber-rich foods',
            'Whole grains are better than refined'
        ]
    }
}


class NutritionEngine:
    """Calculates and analyzes nutrition for toddlers"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def get_rda(self, age_months, toddler=None):
        """
        Get RDA for a toddler's age, adjusted for health conditions.
        If toddler object is provided, adjusts based on weight status and activity level.
        """
        if age_months < 12:
            base_rda = RDA_BY_AGE['6-12_months'].copy()
        elif age_months < 24:
            base_rda = RDA_BY_AGE['12-24_months'].copy()
        elif age_months < 36:
            base_rda = RDA_BY_AGE['24-36_months'].copy()
        else:
            base_rda = RDA_BY_AGE['36+_months'].copy()
        
        # Apply adjustments if toddler object provided
        if toddler:
            calorie_adjustment = toddler.get_calorie_adjustment()
            
            # Adjust calories and macronutrients
            base_rda['calories'] = round(base_rda['calories'] * calorie_adjustment)
            base_rda['protein_g'] = round(base_rda['protein_g'] * calorie_adjustment, 1)
            base_rda['fat_g'] = round(base_rda['fat_g'] * calorie_adjustment, 1)
            base_rda['carbs_g'] = round(base_rda['carbs_g'] * calorie_adjustment, 1)
            
            # Boost specific nutrients based on health conditions
            conditions = toddler.health_conditions or []
            if 'anemia' in conditions or 'low_iron' in conditions:
                base_rda['iron_mg'] = round(base_rda['iron_mg'] * 1.2, 1)  # 20% more iron
            if 'weak_bones' in conditions:
                base_rda['calcium_mg'] = round(base_rda['calcium_mg'] * 1.15)
                base_rda['vitamin_d_mcg'] = round(base_rda['vitamin_d_mcg'] * 1.2, 1)
            if 'constipation' in conditions:
                base_rda['fiber_g'] = round(base_rda['fiber_g'] * 1.25, 1)
        
        return base_rda
    
    def calculate_daily_nutrition(self, meal_logs):
        """Calculate total nutrition from a list of meal logs"""
        totals = defaultdict(float)
        
        for log in meal_logs:
            nutrients = log.get_actual_nutrients()
            if nutrients:
                for key, value in nutrients.items():
                    totals[key] += value
        
        return dict(totals)
    
    def get_nutrition_status(self, toddler, target_date=None):
        """Get nutrition status for a specific date, adjusted for toddler's health"""
        from models import MealLog
        
        if target_date is None:
            target_date = date.today()
        
        # Get all meal logs for the date
        logs = MealLog.query.filter(
            MealLog.toddler_id == toddler.id,
            MealLog.date == target_date
        ).all()
        
        # Calculate actual intake
        actual = self.calculate_daily_nutrition(logs)
        
        # Get adjusted RDA based on toddler's health status
        rda = self.get_rda(toddler.age_months, toddler)
        
        # Get nutrition priorities for highlighting
        priorities = toddler.get_nutrition_priorities()
        
        # Calculate percentages
        status = {}
        for nutrient, rda_value in rda.items():
            actual_value = actual.get(nutrient, 0)
            percentage = (actual_value / rda_value * 100) if rda_value > 0 else 0
            
            status[nutrient] = {
                'actual': round(actual_value, 1),
                'rda': rda_value,
                'percentage': round(percentage, 1),
                'status': self._get_status_label(percentage),
                'info': NUTRIENT_INFO.get(nutrient, {}),
                'is_priority': nutrient in priorities
            }
        
        return status
    
    def _get_status_label(self, percentage):
        """Get status label based on percentage of RDA"""
        if percentage < 50:
            return 'low'
        elif percentage < 80:
            return 'moderate'
        elif percentage <= 150:
            return 'good'
        else:
            return 'excess'
    
    def get_weekly_nutrition(self, toddler, week_start=None):
        """Get nutrition status for a whole week"""
        from models import MealLog
        
        if week_start is None:
            # Get start of current week (Monday)
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
        
        week_end = week_start + timedelta(days=6)
        
        # Get all meal logs for the week
        logs = MealLog.query.filter(
            MealLog.toddler_id == toddler.id,
            MealLog.date >= week_start,
            MealLog.date <= week_end
        ).all()
        
        # Group by date
        daily_logs = defaultdict(list)
        for log in logs:
            daily_logs[log.date].append(log)
        
        # Calculate daily totals
        daily_nutrition = {}
        for day_date, day_logs in daily_logs.items():
            daily_nutrition[day_date.isoformat()] = self.calculate_daily_nutrition(day_logs)
        
        # Calculate weekly averages
        rda = self.get_rda(toddler.age_months)
        weekly_totals = defaultdict(float)
        days_with_data = len(daily_logs)
        
        for day_nutrition in daily_nutrition.values():
            for nutrient, value in day_nutrition.items():
                weekly_totals[nutrient] += value
        
        # Calculate average and compare to RDA
        weekly_status = {}
        for nutrient, rda_value in rda.items():
            total_value = weekly_totals.get(nutrient, 0)
            avg_value = total_value / max(days_with_data, 1)
            weekly_rda = rda_value * 7
            
            weekly_status[nutrient] = {
                'total': round(total_value, 1),
                'daily_average': round(avg_value, 1),
                'weekly_rda': round(weekly_rda, 1),
                'percentage': round((total_value / weekly_rda * 100) if weekly_rda > 0 else 0, 1),
                'status': self._get_status_label((total_value / weekly_rda * 100) if weekly_rda > 0 else 0),
                'info': NUTRIENT_INFO.get(nutrient, {})
            }
        
        return {
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'days_tracked': days_with_data,
            'daily_breakdown': daily_nutrition,
            'weekly_status': weekly_status
        }
    
    def generate_alerts(self, toddler, weekly_nutrition=None):
        """Generate nutrition alerts based on weekly intake"""
        from models import NutritionAlert, Food
        
        if weekly_nutrition is None:
            weekly_nutrition = self.get_weekly_nutrition(toddler)
        
        alerts = []
        weekly_status = weekly_nutrition.get('weekly_status', {})
        days_tracked = weekly_nutrition.get('days_tracked', 0)
        
        # Only generate meaningful alerts if we have at least 3 days of data
        if days_tracked < 3:
            return [{
                'type': 'info',
                'severity': 'info',
                'nutrient': None,
                'message': f'Track at least 3 days of meals to get nutrition insights. Currently tracking: {days_tracked} days.',
                'recommendation': 'Log your toddler\'s meals daily for accurate nutrition analysis.',
                'recommended_foods': []
            }]
        
        # Check each priority nutrient
        for nutrient in PRIORITY_NUTRIENTS:
            status = weekly_status.get(nutrient, {})
            percentage = status.get('percentage', 0)
            
            if percentage < 50:
                severity = 'critical'
            elif percentage < 70:
                severity = 'warning'
            else:
                continue  # No alert needed
            
            nutrient_info = NUTRIENT_INFO.get(nutrient, {})
            recommendations = NUTRIENT_FOOD_RECOMMENDATIONS.get(nutrient, {})
            
            # Get recommended foods that the toddler can eat
            is_veg = toddler.dietary_preference == 'vegetarian'
            food_names = recommendations.get('veg_foods', [])
            if not is_veg:
                food_names.extend(recommendations.get('non_veg_foods', []))
            
            # Filter by allergens
            safe_foods = []
            for food_name in food_names:
                food = Food.query.filter(Food.name == food_name).first()
                if food:
                    # Check allergens
                    has_allergen = False
                    for allergen in (toddler.allergies or []):
                        if allergen in (food.allergens or []):
                            has_allergen = True
                            break
                    if not has_allergen and food.suitable_from_months <= toddler.age_months:
                        safe_foods.append({
                            'id': food.id,
                            'name': food.name,
                            'name_hindi': food.name_hindi
                        })
            
            alert = {
                'type': 'deficiency',
                'severity': severity,
                'nutrient': nutrient,
                'nutrient_name': nutrient_info.get('name', nutrient),
                'icon': nutrient_info.get('icon', ''),
                'message': f"{nutrient_info.get('name', nutrient)} intake is low ({percentage:.0f}% of recommended). {recommendations.get('message', '')}",
                'percentage': percentage,
                'recommendation': recommendations.get('tips', [''])[0] if recommendations.get('tips') else '',
                'all_tips': recommendations.get('tips', []),
                'recommended_foods': safe_foods[:5]  # Top 5 foods
            }
            alerts.append(alert)
        
        # Check for variety - IMPORTANT for preventing picky eating
        from models import MealLog, FoodPreference
        
        unique_foods = self.db.query(MealLog.food_id).filter(
            MealLog.toddler_id == toddler.id,
            MealLog.date >= date.today() - timedelta(days=7),
            MealLog.food_id.isnot(None)
        ).distinct().count()
        
        # Get food preferences to check for selectivity
        prefs = FoodPreference.query.filter_by(toddler_id=toddler.id).all()
        refused_foods = [p for p in prefs if p.preference_score < 0]
        challenging_foods = [p for p in prefs if p.preference_score < 0 and p.times_offered >= 10]
        needs_exposure = [p for p in prefs if p.needs_reexposure()]
        
        # Variety alerts
        if unique_foods < 8 and days_tracked >= 3:
            alerts.append({
                'type': 'variety',
                'severity': 'warning',
                'nutrient': None,
                'message': f'⚠️ Only {unique_foods} different foods this week - toddler may be becoming selective!',
                'recommendation': 'Food selectivity can lead to nutrient gaps. Try introducing 1-2 new foods alongside favorites.',
                'recommended_foods': [],
                'tips': [
                    'Pair new foods with accepted favorites on the same plate',
                    'Let toddler see you eating and enjoying the same foods',
                    'Offer new foods when toddler is hungry but not starving',
                    'Don\'t force - just keep offering with no pressure'
                ]
            })
        elif unique_foods < 12 and days_tracked >= 3:
            alerts.append({
                'type': 'variety',
                'severity': 'info',
                'nutrient': None,
                'message': f'Only {unique_foods} different foods this week. Aim for 15-20 for better nutrition.',
                'recommendation': 'More variety ensures broader nutrient intake and prevents picky eating.',
                'recommended_foods': []
            })
        
        # Selectivity/Picky eating alert
        if len(refused_foods) > 5 and len(prefs) > 0:
            refusal_rate = len(refused_foods) / len(prefs) * 100
            if refusal_rate > 30:
                alerts.append({
                    'type': 'selectivity',
                    'severity': 'warning',
                    'nutrient': None,
                    'message': f'🍽️ Toddler has refused {len(refused_foods)} foods ({refusal_rate:.0f}% of tried foods). This is normal but needs attention.',
                    'recommendation': 'Research shows it takes 10-15 exposures for a child to accept new food. Keep offering!',
                    'recommended_foods': [],
                    'tips': [
                        f'{len(needs_exposure)} foods are ready for re-exposure this week',
                        'Serve tiny portions of refused foods alongside favorites',
                        'Make mealtimes stress-free - no bribing or forcing',
                        'Involve toddler in food prep when safe',
                        'Model eating the same foods yourself'
                    ]
                })
        
        # Re-exposure reminder
        if len(needs_exposure) > 0 and days_tracked >= 3:
            food_names = []
            for pref in needs_exposure[:3]:
                if pref.food:
                    food_names.append(pref.food.name)
            
            if food_names:
                alerts.append({
                    'type': 'reexposure',
                    'severity': 'info',
                    'nutrient': None,
                    'message': f'💪 Time to retry: {", ".join(food_names)} (and {len(needs_exposure) - 3} more)' if len(needs_exposure) > 3 else f'💪 Time to retry: {", ".join(food_names)}',
                    'recommendation': 'These foods were refused before but haven\'t been offered in 3+ days. Try again!',
                    'recommended_foods': [{'id': p.food_id, 'name': p.food.name if p.food else 'Unknown'} for p in needs_exposure[:5]],
                    'tips': [
                        'Offer a tiny taste alongside a favorite food',
                        'Stay neutral - don\'t show disappointment if refused',
                        'Praise any interaction (touching, smelling, licking counts!)'
                    ]
                })
        
        return alerts
    
    def get_food_suggestions_for_meal(self, toddler, meal_type, current_day_nutrition=None):
        """Suggest foods for a specific meal based on nutrition gaps"""
        from models import Food, FoodPreference
        
        # Get RDA and current nutrition
        rda = self.get_rda(toddler.age_months)
        
        if current_day_nutrition is None:
            nutrition_status = self.get_nutrition_status(toddler)
            current_day_nutrition = {
                k: v['actual'] for k, v in nutrition_status.items()
            }
        
        # Find deficient nutrients
        deficient = []
        for nutrient in PRIORITY_NUTRIENTS:
            current = current_day_nutrition.get(nutrient, 0)
            target = rda.get(nutrient, 0)
            if target > 0 and (current / target) < 0.7:
                deficient.append(nutrient)
        
        # Get suitable foods
        is_veg = toddler.dietary_preference == 'vegetarian'
        suitable_foods = Food.query.filter(
            Food.suitable_from_months <= toddler.age_months
        ).all()
        
        # Filter and score foods
        scored_foods = []
        for food in suitable_foods:
            # Skip if contains allergens
            has_allergen = False
            for allergen in (toddler.allergies or []):
                if allergen in (food.allergens or []):
                    has_allergen = True
                    break
            if has_allergen:
                continue
            
            # Skip non-veg if vegetarian
            if is_veg and food.category == 'protein' and 'egg' not in food.name.lower():
                if 'chicken' in food.name.lower() or 'fish' in food.name.lower():
                    continue
            
            # Calculate nutrition score
            score = 0
            for nutrient in deficient:
                nutrient_value = getattr(food, nutrient, 0) or 0
                rda_value = rda.get(nutrient, 1)
                if rda_value > 0:
                    score += (nutrient_value / rda_value) * 10
            
            # Get preference score
            pref = FoodPreference.query.filter_by(
                toddler_id=toddler.id,
                food_id=food.id
            ).first()
            
            preference_score = pref.preference_score if pref else 0
            
            # Combine scores (nutrition weight 0.6, preference weight 0.4)
            final_score = score * 0.6 + (preference_score + 2) * 5 * 0.4
            
            # Categorize by meal type appropriateness
            meal_appropriate = self._is_appropriate_for_meal(food, meal_type)
            if meal_appropriate:
                final_score += 5
            
            scored_foods.append({
                'food': food,
                'score': final_score,
                'preference': preference_score,
                'fills_gaps': [n for n in deficient if (getattr(food, n, 0) or 0) > 0]
            })
        
        # Sort by score
        scored_foods.sort(key=lambda x: x['score'], reverse=True)
        
        # Return top 5 suggestions
        suggestions = []
        for item in scored_foods[:5]:
            food = item['food']
            suggestions.append({
                'food': food.to_dict(),
                'score': round(item['score'], 1),
                'preference': item['preference'],
                'fills_gaps': item['fills_gaps'],
                'reason': self._get_suggestion_reason(food, item['fills_gaps'])
            })
        
        return suggestions
    
    def _is_appropriate_for_meal(self, food, meal_type):
        """Check if food is appropriate for the meal type"""
        breakfast_foods = ['grain', 'dairy', 'fruit']
        lunch_dinner_foods = ['grain', 'dal', 'vegetable', 'protein', 'combo']
        snack_foods = ['fruit', 'dairy', 'snack']
        
        if meal_type == 'breakfast':
            return food.category in breakfast_foods or 'breakfast' in (food.name or '').lower()
        elif meal_type in ['lunch', 'dinner']:
            return food.category in lunch_dinner_foods
        elif 'snack' in meal_type:
            return food.category in snack_foods
        return True
    
    def _get_suggestion_reason(self, food, fills_gaps):
        """Generate human-readable reason for suggestion"""
        if not fills_gaps:
            return "Good balanced option"
        
        gap_names = [NUTRIENT_INFO.get(g, {}).get('name', g) for g in fills_gaps[:2]]
        return f"Rich in {', '.join(gap_names)}"


def adapt_adult_meal_for_toddler(adult_meal_description, db_session, toddler):
    """
    Suggest toddler-friendly adaptations for an adult meal.
    Uses alias-aware keyword matching — never matches stop words like 'with'.
    """
    from models import Food
    from ai_features import FOOD_ALIASES, NLP_STOP_WORDS, find_foods_in_text, normalize_text
    
    adult_meal_lower = normalize_text(adult_meal_description)
    
    # Extract food concepts from the adult meal text
    parsed_foods = find_foods_in_text(adult_meal_description)
    keywords = set()
    for pf in parsed_foods:
        name = pf['name'].lower()
        keywords.add(name)
        keywords.update(FOOD_ALIASES.get(name, []))
        keywords.add(pf.get('matched_text', '').lower())
    
    # Also keep significant raw tokens (≥4 chars, not stop words)
    for word in adult_meal_lower.split():
        if len(word) >= 4 and word not in NLP_STOP_WORDS:
            keywords.add(word)
    
    keywords = {k for k in keywords if k and k not in NLP_STOP_WORDS}
    
    # Score each food in the database
    scored = []
    all_foods = Food.query.filter(
        Food.suitable_from_months <= toddler.age_months
    ).all()
    
    toddler_allergens = set(toddler.allergies or [])
    
    for food in all_foods:
        # Skip allergen foods
        if toddler_allergens and any(a in (food.allergens or []) for a in toddler_allergens):
            continue
        
        food_name_lower = food.name.lower()
        hindi_name_lower = (food.name_hindi or '').lower()
        
        # Significant words from food name (ignore 'with', 'and', etc.)
        # Strip punctuation so "Rajma (Kidney Beans)" → rajma, kidney, beans
        cleaned_name = re.sub(r'[()\[\]{},.]', ' ', food_name_lower)
        cleaned_hindi = re.sub(r'[()\[\]{},.]', ' ', hindi_name_lower)
        name_tokens = [
            t for t in re.split(r'[\s/+\-]+', cleaned_name)
            if len(t) >= 3 and t not in NLP_STOP_WORDS
        ]
        hindi_tokens = [
            t for t in re.split(r'[\s/+\-]+', cleaned_hindi)
            if len(t) >= 3 and t not in NLP_STOP_WORDS
        ]
        all_tokens = set(name_tokens + hindi_tokens)
        
        # Map each keyword to a canonical concept once (avoid alias multi-counting)
        matched_concepts = set()
        matched_keywords = []
        
        for kw in keywords:
            # Direct token / name match
            if kw in all_tokens or cleaned_name.startswith(kw) or cleaned_hindi.startswith(kw):
                matched_concepts.add(kw)
                matched_keywords.append(kw)
                continue
            if len(kw) >= 4 and (
                re.search(rf'\b{re.escape(kw)}\b', cleaned_name) or
                re.search(rf'\b{re.escape(kw)}\b', cleaned_hindi)
            ):
                matched_concepts.add(kw)
                matched_keywords.append(kw)
                continue
            
            # Alias → canonical concept (count once per food_key)
            for food_key, aliases in FOOD_ALIASES.items():
                all_names = [food_key] + list(aliases)
                if kw not in all_names:
                    continue
                if any(an in all_tokens for an in all_names) or \
                   any(cleaned_name.startswith(an) for an in all_names):
                    matched_concepts.add(food_key)
                    matched_keywords.append(food_key)
                    break
        
        if not matched_concepts:
            continue
        
        # Base score: unique concepts matched (not every alias variant)
        score = len(matched_concepts) * 12
        
        # Strong boost when the food's primary name is what the parent mentioned
        # e.g. keyword "rajma" → "Rajma (Kidney Beans)" beats generic rice sides
        primary_token = name_tokens[0] if name_tokens else ''
        if primary_token and (primary_token in keywords or primary_token in matched_concepts):
            score += 30
        
        # Dish specificity: multi-word named dishes that match (Lobia with Roti)
        if len(name_tokens) >= 2 and sum(1 for t in name_tokens if t in keywords or t in matched_concepts) >= 2:
            score += 15
        
        # Prefer protein/dal/veg mains over staple carbs when both present
        if food.category in ['dal', 'vegetable', 'protein']:
            score += 8
        elif food.category == 'combo':
            score += 6
        elif food.category == 'grain' and any(g in primary_token for g in ['rice', 'chawal']):
            score += 2  # rice is a side unless it's the only match
        elif food.category == 'grain':
            score += 4  # roti etc.
        
        # Penalize breakfast-only combos unless keywords clearly match them
        meal_type_attr = getattr(food, 'meal_type', None) or ''
        if meal_type_attr == 'breakfast' and not any(
            t in matched_concepts or t in keywords for t in name_tokens[:2]
        ):
            continue
        
        scored.append((score, food, matched_keywords))
    
    # Sort by score descending, take top matches
    scored.sort(key=lambda x: x[0], reverse=True)
    
    adaptations = []
    seen_ids = set()
    for score, food, matched_kw in scored[:6]:
        if food.id in seen_ids:
            continue
        seen_ids.add(food.id)
        
        adaptations.append({
            'original_food': food.name,
            'food_id': food.id,
            'match_score': score,
            'matched_keywords': list(set(matched_kw)),
            'toddler_version': food.toddler_friendly_version or f"Serve {food.name} in small portions, mild spices",
            'preparation_tips': food.preparation_tips,
            'serving_size': food.get_serving_for_age(toddler.age_months),
            'spice_warning': food.spice_level > 1,
            'texture': food.texture,
            'category': food.category,
            'nutrients': food.to_dict()
        })
    
    # If no DB matches but we parsed foods, create synthetic adaptation tips
    synthetic = []
    if not adaptations and parsed_foods:
        for pf in parsed_foods:
            synthetic.append({
                'original_food': pf['name'],
                'food_id': None,
                'match_score': pf.get('confidence', 0.5),
                'matched_keywords': [pf.get('matched_text', '')],
                'toddler_version': f"Serve mild {pf['name']} in soft, bite-sized pieces",
                'preparation_tips': "Reduce spice; mash or cut small; pair with a familiar carb like roti or rice.",
                'serving_size': 50,
                'spice_warning': False,
                'texture': 'soft',
                'category': 'unknown',
                'nutrients': {}
            })
    
    # General tips based on meal type
    general_tips = []
    
    if any(word in adult_meal_lower for word in ['curry', 'masala', 'spicy', 'tadka']):
        general_tips.append("Reduce spices significantly - toddlers have sensitive taste buds")
        general_tips.append("Set aside toddler portion before adding chillies/garam masala")
    
    if any(word in adult_meal_lower for word in ['fried', 'fry', 'tawa', 'crispy']):
        general_tips.append("Consider baking/steaming instead of frying for toddler portion")
    
    if any(word in adult_meal_lower for word in ['whole', 'chunks', 'large']):
        general_tips.append("Cut into small, bite-sized pieces or mash for younger toddlers")
    
    if any(word in adult_meal_lower for word in ['salt', 'salty', 'namkeen']):
        general_tips.append("Reduce salt content for toddler - their kidneys are still developing")
    
    if any(k in keywords for k in ['lobia', 'rajma', 'chole', 'dal']):
        general_tips.append("Cook legumes until very soft; mash lightly for younger toddlers")
        general_tips.append("Pair with roti or rice plus a cooling side like cucumber or dahi")
    
    return {
        'adult_meal': adult_meal_description,
        'detected_foods': [pf['name'] for pf in parsed_foods],
        'matched_foods': adaptations or synthetic,
        'general_tips': general_tips,
        'toddler_name': toddler.name,
        'toddler_age_months': toddler.age_months
    }
