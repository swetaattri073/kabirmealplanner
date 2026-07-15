"""
Database models for Toddler Meal Planner
Uses SQLite with SQLAlchemy ORM
"""

from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON

db = SQLAlchemy()


class Toddler(db.Model):
    """Toddler profile with basic info and preferences"""
    __tablename__ = 'toddlers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    age_months = db.Column(db.Integer, nullable=False)
    birth_date = db.Column(db.Date, nullable=True)
    allergies = db.Column(JSON, default=list)  # List of allergen strings
    dietary_preference = db.Column(db.String(50), default='vegetarian')  # vegetarian, non-vegetarian, eggetarian
    meal_schedule = db.Column(JSON, nullable=True)  # Custom schedule if provided
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    meal_logs = db.relationship('MealLog', backref='toddler', lazy='dynamic', cascade='all, delete-orphan')
    preferences = db.relationship('FoodPreference', backref='toddler', lazy='dynamic', cascade='all, delete-orphan')
    weekly_plans = db.relationship('WeeklyPlan', backref='toddler', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_age_group(self):
        """Returns age group for RDA calculations"""
        if self.age_months < 12:
            return '6-12_months'
        elif self.age_months < 24:
            return '12-24_months'
        elif self.age_months < 36:
            return '24-36_months'
        else:
            return '36+_months'
    
    def get_recommended_schedule(self):
        """Returns recommended meal schedule based on age"""
        if self.meal_schedule:
            return self.meal_schedule
        
        if self.age_months < 12:
            return {
                'meals': ['breakfast', 'lunch', 'dinner'],
                'snacks': ['mid_morning_snack'],
                'milk_feeds': 3  # Breast/formula feeds
            }
        elif self.age_months < 24:
            return {
                'meals': ['breakfast', 'lunch', 'dinner'],
                'snacks': ['mid_morning_snack', 'evening_snack'],
                'milk_feeds': 2
            }
        else:
            return {
                'meals': ['breakfast', 'lunch', 'dinner'],
                'snacks': ['mid_morning_snack', 'evening_snack'],
                'milk_feeds': 1
            }
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'age_months': self.age_months,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'allergies': self.allergies or [],
            'dietary_preference': self.dietary_preference,
            'meal_schedule': self.get_recommended_schedule(),
            'age_group': self.get_age_group(),
            'created_at': self.created_at.isoformat()
        }


class Food(db.Model):
    """Food item with nutritional information"""
    __tablename__ = 'foods'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    name_hindi = db.Column(db.String(200), nullable=True)
    category = db.Column(db.String(50), nullable=False)  # grain, dal, vegetable, fruit, dairy, protein, snack, beverage
    
    # Nutritional info per 100g serving
    calories = db.Column(db.Float, default=0)
    protein_g = db.Column(db.Float, default=0)
    carbs_g = db.Column(db.Float, default=0)
    fat_g = db.Column(db.Float, default=0)
    fiber_g = db.Column(db.Float, default=0)
    
    # Micronutrients
    calcium_mg = db.Column(db.Float, default=0)
    iron_mg = db.Column(db.Float, default=0)
    zinc_mg = db.Column(db.Float, default=0)
    vitamin_a_mcg = db.Column(db.Float, default=0)
    vitamin_c_mg = db.Column(db.Float, default=0)
    vitamin_d_mcg = db.Column(db.Float, default=0)
    vitamin_b12_mcg = db.Column(db.Float, default=0)
    folate_mcg = db.Column(db.Float, default=0)
    
    # Food characteristics
    is_indian = db.Column(db.Boolean, default=True)
    spice_level = db.Column(db.Integer, default=0)  # 0-5 scale
    texture = db.Column(db.String(50), default='soft')  # puree, mashed, soft, regular, crunchy
    allergens = db.Column(JSON, default=list)  # List of allergens
    suitable_from_months = db.Column(db.Integer, default=6)
    
    # For meal adaptation
    toddler_friendly_version = db.Column(db.String(500), nullable=True)
    preparation_tips = db.Column(db.String(500), nullable=True)
    
    # Typical serving sizes for toddlers (in grams)
    serving_size_6_12 = db.Column(db.Float, default=30)
    serving_size_12_24 = db.Column(db.Float, default=50)
    serving_size_24_36 = db.Column(db.Float, default=75)
    
    def get_serving_for_age(self, age_months):
        """Returns appropriate serving size in grams"""
        if age_months < 12:
            return self.serving_size_6_12
        elif age_months < 24:
            return self.serving_size_12_24
        else:
            return self.serving_size_24_36
    
    def get_nutrients_for_serving(self, serving_grams):
        """Returns nutrients for a given serving size"""
        factor = serving_grams / 100.0
        return {
            'calories': self.calories * factor,
            'protein_g': self.protein_g * factor,
            'carbs_g': self.carbs_g * factor,
            'fat_g': self.fat_g * factor,
            'fiber_g': self.fiber_g * factor,
            'calcium_mg': self.calcium_mg * factor,
            'iron_mg': self.iron_mg * factor,
            'zinc_mg': self.zinc_mg * factor,
            'vitamin_a_mcg': self.vitamin_a_mcg * factor,
            'vitamin_c_mg': self.vitamin_c_mg * factor,
            'vitamin_d_mcg': self.vitamin_d_mcg * factor,
            'vitamin_b12_mcg': self.vitamin_b12_mcg * factor,
            'folate_mcg': self.folate_mcg * factor
        }
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'name_hindi': self.name_hindi,
            'category': self.category,
            'calories': self.calories,
            'protein_g': self.protein_g,
            'carbs_g': self.carbs_g,
            'fat_g': self.fat_g,
            'fiber_g': self.fiber_g,
            'calcium_mg': self.calcium_mg,
            'iron_mg': self.iron_mg,
            'zinc_mg': self.zinc_mg,
            'vitamin_a_mcg': self.vitamin_a_mcg,
            'vitamin_c_mg': self.vitamin_c_mg,
            'vitamin_d_mcg': self.vitamin_d_mcg,
            'spice_level': self.spice_level,
            'texture': self.texture,
            'allergens': self.allergens or [],
            'suitable_from_months': self.suitable_from_months,
            'toddler_friendly_version': self.toddler_friendly_version,
            'preparation_tips': self.preparation_tips
        }


class MealLog(db.Model):
    """Daily meal log for tracking what toddler ate"""
    __tablename__ = 'meal_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=False)
    food_id = db.Column(db.Integer, db.ForeignKey('foods.id'), nullable=True)
    
    date = db.Column(db.Date, nullable=False, default=date.today)
    meal_type = db.Column(db.String(50), nullable=False)  # breakfast, lunch, dinner, mid_morning_snack, evening_snack
    
    # If custom food not in database
    custom_food_name = db.Column(db.String(200), nullable=True)
    
    # How much was eaten
    portion_offered_g = db.Column(db.Float, nullable=True)
    portion_eaten_percent = db.Column(db.Integer, default=100)  # 0, 25, 50, 75, 100
    
    # Was this adapted from adult meal?
    is_adult_meal_adapted = db.Column(db.Boolean, default=False)
    adult_meal_description = db.Column(db.String(500), nullable=True)
    
    # Feedback
    toddler_reaction = db.Column(db.String(50), nullable=True)  # loved, liked, neutral, disliked, refused
    notes = db.Column(db.String(500), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    food = db.relationship('Food', backref='meal_logs')
    
    def get_actual_nutrients(self):
        """Calculate nutrients actually consumed"""
        if not self.food:
            return None
        
        serving = self.portion_offered_g or self.food.get_serving_for_age(self.toddler.age_months)
        actual_serving = serving * (self.portion_eaten_percent / 100.0)
        return self.food.get_nutrients_for_serving(actual_serving)
    
    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'food_id': self.food_id,
            'food': self.food.to_dict() if self.food else None,
            'custom_food_name': self.custom_food_name,
            'date': self.date.isoformat(),
            'meal_type': self.meal_type,
            'portion_offered_g': self.portion_offered_g,
            'portion_eaten_percent': self.portion_eaten_percent,
            'is_adult_meal_adapted': self.is_adult_meal_adapted,
            'adult_meal_description': self.adult_meal_description,
            'toddler_reaction': self.toddler_reaction,
            'notes': self.notes,
            'nutrients': self.get_actual_nutrients()
        }


class FoodPreference(db.Model):
    """Track toddler's food preferences over time"""
    __tablename__ = 'food_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=False)
    food_id = db.Column(db.Integer, db.ForeignKey('foods.id'), nullable=False)
    
    # Preference score: -2 (always refuses) to +2 (always loves)
    preference_score = db.Column(db.Float, default=0)
    times_offered = db.Column(db.Integer, default=0)
    times_accepted = db.Column(db.Integer, default=0)
    last_offered = db.Column(db.Date, nullable=True)
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    food = db.relationship('Food', backref='preferences')
    
    def update_from_reaction(self, reaction):
        """Update preference based on meal reaction"""
        reaction_scores = {
            'loved': 2,
            'liked': 1,
            'neutral': 0,
            'disliked': -1,
            'refused': -2
        }
        
        score = reaction_scores.get(reaction, 0)
        self.times_offered += 1
        if score > 0:
            self.times_accepted += 1
        
        # Weighted average favoring recent reactions
        weight = 0.3  # New reaction weight
        self.preference_score = (1 - weight) * self.preference_score + weight * score
        self.last_offered = date.today()
    
    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'food_id': self.food_id,
            'food': self.food.to_dict() if self.food else None,
            'preference_score': self.preference_score,
            'times_offered': self.times_offered,
            'times_accepted': self.times_accepted,
            'acceptance_rate': (self.times_accepted / self.times_offered * 100) if self.times_offered > 0 else None,
            'last_offered': self.last_offered.isoformat() if self.last_offered else None
        }


class WeeklyPlan(db.Model):
    """Weekly meal plan"""
    __tablename__ = 'weekly_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=False)
    
    week_start = db.Column(db.Date, nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday, 6=Sunday
    meal_type = db.Column(db.String(50), nullable=False)
    food_id = db.Column(db.Integer, db.ForeignKey('foods.id'), nullable=True)
    
    # Alternative suggestions
    alternatives = db.Column(JSON, default=list)  # List of food_ids
    
    # Plan metadata
    is_generated = db.Column(db.Boolean, default=True)  # vs manually set
    nutrition_reason = db.Column(db.String(500), nullable=True)  # Why this food was suggested
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    food = db.relationship('Food', backref='planned_meals')
    
    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'week_start': self.week_start.isoformat(),
            'day_of_week': self.day_of_week,
            'meal_type': self.meal_type,
            'food_id': self.food_id,
            'food': self.food.to_dict() if self.food else None,
            'alternatives': self.alternatives,
            'is_generated': self.is_generated,
            'nutrition_reason': self.nutrition_reason
        }


class NutritionAlert(db.Model):
    """Track nutrition alerts and recommendations"""
    __tablename__ = 'nutrition_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=False)
    
    alert_date = db.Column(db.Date, nullable=False, default=date.today)
    alert_type = db.Column(db.String(50), nullable=False)  # deficiency, excess, variety
    nutrient = db.Column(db.String(50), nullable=True)  # iron, calcium, etc.
    
    severity = db.Column(db.String(20), default='info')  # info, warning, critical
    message = db.Column(db.String(500), nullable=False)
    recommendation = db.Column(db.String(500), nullable=True)
    recommended_foods = db.Column(JSON, default=list)  # List of food_ids
    
    is_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'alert_date': self.alert_date.isoformat(),
            'alert_type': self.alert_type,
            'nutrient': self.nutrient,
            'severity': self.severity,
            'message': self.message,
            'recommendation': self.recommendation,
            'recommended_foods': self.recommended_foods,
            'is_resolved': self.is_resolved
        }
