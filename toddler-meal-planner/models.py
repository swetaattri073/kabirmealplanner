"""
Database models for Toddler Meal Planner
Uses SQLite with SQLAlchemy ORM
"""

from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from sqlalchemy import JSON
import bcrypt

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """User model for authentication - optional for app usage"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)  # Null for OAuth-only users
    name = db.Column(db.String(100), nullable=True)
    
    # Social / OAuth identity
    oauth_provider = db.Column(db.String(30), nullable=True)  # google, facebook, apple
    oauth_id = db.Column(db.String(255), nullable=True, index=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    
    # Subscription & features
    subscription_tier = db.Column(db.String(20), default='free')  # free, premium, family
    subscription_expires = db.Column(db.DateTime, nullable=True)
    
    # Account status
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    toddlers = db.relationship('Toddler', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), 
            bcrypt.gensalt()
        ).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        if not self.password_hash:
            return False
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )
    
    def is_premium(self):
        """Check if user has active premium subscription"""
        if self.subscription_tier == 'free':
            return False
        if self.subscription_expires and self.subscription_expires < datetime.utcnow():
            return False
        return True
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'oauth_provider': self.oauth_provider,
            'avatar_url': self.avatar_url,
            'subscription_tier': self.subscription_tier,
            'is_premium': self.is_premium(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'toddler_count': self.toddlers.count()
        }


class Toddler(db.Model):
    """Toddler profile with basic info and preferences"""
    __tablename__ = 'toddlers'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Owner - either a logged-in user or anonymous session
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    session_id = db.Column(db.String(64), nullable=True, index=True)  # For anonymous users
    
    name = db.Column(db.String(100), nullable=False)
    age_months = db.Column(db.Integer, nullable=False)
    birth_date = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(10), default='unknown')  # male, female, unknown
    
    # Physical measurements for growth tracking
    weight_kg = db.Column(db.Float, nullable=True)  # Current weight in kg
    height_cm = db.Column(db.Float, nullable=True)  # Current height in cm
    weight_updated_at = db.Column(db.Date, nullable=True)  # When weight was last updated
    
    # Health & Activity
    activity_level = db.Column(db.String(20), default='moderate')  # low, moderate, high, very_high
    health_conditions = db.Column(JSON, default=list)  # List: underweight, overweight, anemia, constipation, etc.
    health_notes = db.Column(db.String(500), nullable=True)  # Additional health notes
    
    # Dietary info
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
    
    def get_weight_status(self):
        """
        Calculate weight-for-age status using simplified WHO standards.
        Returns: 'severely_underweight', 'underweight', 'normal', 'overweight', 'obese', or None
        """
        if not self.weight_kg or not self.age_months:
            return None
        
        # Simplified WHO weight-for-age median values (kg) by age in months
        # Using average of male/female for simplicity
        who_median_weight = {
            6: 7.5, 7: 7.9, 8: 8.3, 9: 8.6, 10: 8.9, 11: 9.2, 12: 9.4,
            13: 9.6, 14: 9.8, 15: 10.0, 16: 10.2, 17: 10.4, 18: 10.6,
            19: 10.8, 20: 11.0, 21: 11.2, 22: 11.4, 23: 11.6, 24: 11.8,
            25: 12.0, 26: 12.2, 27: 12.4, 28: 12.6, 29: 12.8, 30: 13.0,
            31: 13.2, 32: 13.4, 33: 13.5, 34: 13.7, 35: 13.9, 36: 14.1,
            48: 16.0, 60: 18.5
        }
        
        # Get closest age reference
        age = min(self.age_months, 60)
        if age < 6:
            age = 6
        
        # Find nearest reference age
        ref_ages = sorted(who_median_weight.keys())
        closest_age = min(ref_ages, key=lambda x: abs(x - age))
        median = who_median_weight[closest_age]
        
        # Calculate percentage of median
        percent_of_median = (self.weight_kg / median) * 100
        
        if percent_of_median < 70:
            return 'severely_underweight'
        elif percent_of_median < 80:
            return 'underweight'
        elif percent_of_median <= 120:
            return 'normal'
        elif percent_of_median <= 140:
            return 'overweight'
        else:
            return 'obese'
    
    def get_calorie_adjustment(self):
        """
        Calculate calorie adjustment factor based on weight status and activity level.
        Returns a multiplier (e.g., 1.0 = no change, 1.2 = 20% more calories)
        """
        base_multiplier = 1.0
        
        # Activity level adjustments
        activity_multipliers = {
            'low': 0.9,
            'moderate': 1.0,
            'high': 1.15,
            'very_high': 1.25
        }
        base_multiplier *= activity_multipliers.get(self.activity_level, 1.0)
        
        # Weight status adjustments
        weight_status = self.get_weight_status()
        if weight_status == 'severely_underweight':
            base_multiplier *= 1.3  # Need 30% more calories
        elif weight_status == 'underweight':
            base_multiplier *= 1.15  # Need 15% more calories
        elif weight_status == 'overweight':
            base_multiplier *= 0.95  # Slight reduction
        elif weight_status == 'obese':
            base_multiplier *= 0.9  # More reduction
        
        # Health condition adjustments
        conditions = self.health_conditions or []
        if 'recovering_from_illness' in conditions:
            base_multiplier *= 1.1
        if 'poor_appetite' in conditions:
            base_multiplier *= 1.0  # Focus on calorie-dense foods instead
        
        return round(base_multiplier, 2)
    
    def get_nutrition_priorities(self):
        """
        Get prioritized nutrients based on health conditions.
        Returns list of nutrients that should be emphasized.
        """
        priorities = []
        conditions = self.health_conditions or []
        weight_status = self.get_weight_status()
        
        # Weight-based priorities
        if weight_status in ['severely_underweight', 'underweight']:
            priorities.extend(['calories', 'protein_g', 'fat_g'])
        elif weight_status in ['overweight', 'obese']:
            priorities.extend(['fiber_g', 'protein_g'])
        
        # Condition-based priorities
        if 'anemia' in conditions or 'low_iron' in conditions:
            priorities.extend(['iron_mg', 'vitamin_c_mg'])  # Vitamin C helps iron absorption
        if 'weak_bones' in conditions or 'delayed_teething' in conditions:
            priorities.extend(['calcium_mg', 'vitamin_d_mcg'])
        if 'constipation' in conditions:
            priorities.extend(['fiber_g'])
        if 'frequent_illness' in conditions:
            priorities.extend(['vitamin_a_mcg', 'vitamin_c_mg', 'zinc_mg'])
        if 'vegetarian_b12_risk' in conditions or self.dietary_preference == 'vegetarian':
            priorities.extend(['vitamin_b12_mcg', 'iron_mg'])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_priorities = []
        for p in priorities:
            if p not in seen:
                seen.add(p)
                unique_priorities.append(p)
        
        return unique_priorities
    
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
    
    @property
    def ref(self):
        """Opaque signed id for URLs (never expose raw primary key in the address bar)."""
        from toddler_refs import encode_toddler_ref
        try:
            return encode_toddler_ref(self.id)
        except Exception:
            return str(self.id)

    def to_dict(self):
        return {
            'id': self.id,
            'ref': self.ref,
            'name': self.name,
            'age_months': self.age_months,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'gender': self.gender,
            'weight_kg': self.weight_kg,
            'height_cm': self.height_cm,
            'weight_status': self.get_weight_status(),
            'activity_level': self.activity_level,
            'health_conditions': self.health_conditions or [],
            'health_notes': self.health_notes,
            'allergies': self.allergies or [],
            'dietary_preference': self.dietary_preference,
            'meal_schedule': self.get_recommended_schedule(),
            'age_group': self.get_age_group(),
            'calorie_adjustment': self.get_calorie_adjustment(),
            'nutrition_priorities': self.get_nutrition_priorities(),
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
    
    # User-added / enrichment metadata
    is_user_added = db.Column(db.Boolean, default=False)
    nutrition_pending = db.Column(db.Boolean, default=False)
    nutrition_source = db.Column(db.String(50), nullable=True)  # openfoodfacts, category_estimate, seeded
    nutrition_enriched_at = db.Column(db.DateTime, nullable=True)
    nutrition_match_name = db.Column(db.String(200), nullable=True)  # matched external product name
    
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
            'vitamin_b12_mcg': self.vitamin_b12_mcg,
            'folate_mcg': self.folate_mcg,
            'serving_size_6_12': self.serving_size_6_12,
            'serving_size_12_24': self.serving_size_12_24,
            'serving_size_24_36': self.serving_size_24_36,
            'spice_level': self.spice_level,
            'texture': self.texture,
            'allergens': self.allergens or [],
            'suitable_from_months': self.suitable_from_months,
            'toddler_friendly_version': self.toddler_friendly_version,
            'preparation_tips': self.preparation_tips,
            'is_user_added': bool(self.is_user_added),
            'nutrition_pending': bool(self.nutrition_pending),
            'nutrition_source': self.nutrition_source,
            'nutrition_enriched_at': self.nutrition_enriched_at.isoformat() if self.nutrition_enriched_at else None,
            'nutrition_match_name': self.nutrition_match_name,
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
    photo_path = db.Column(db.String(500), nullable=True)  # Optional meal photo
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    food = db.relationship('Food', backref='meal_logs')
    
    def effective_portion_eaten_percent(self):
        """
        Portion that contributes to nutrition stats.
        Refused foods count as 0% eaten even if the slider was left at 100%.
        """
        if (self.toddler_reaction or '').lower() == 'refused':
            return 0
        pct = self.portion_eaten_percent
        if pct is None:
            return 100
        return max(0, min(100, int(pct)))

    def get_actual_nutrients(self):
        """Calculate nutrients actually consumed (respects portion % and refusals)."""
        detail = self.get_nutrition_calculation()
        return detail['nutrients'] if detail else None

    def get_nutrition_calculation(self):
        """
        Nutrients plus the portion math used so UIs can show a transparent breakdown.
        Returns None when there is no linked food (custom name-only items).
        """
        if not self.food:
            return None

        portion_pct = self.effective_portion_eaten_percent()
        age_months = self.toddler.age_months if self.toddler else 24
        serving = self.portion_offered_g or self.food.get_serving_for_age(age_months) or 0
        actual_serving = serving * (portion_pct / 100.0) if serving else 0
        nutrients = self.food.get_nutrients_for_serving(actual_serving) if actual_serving > 0 else {
            'calories': 0.0,
            'protein_g': 0.0,
            'carbs_g': 0.0,
            'fat_g': 0.0,
            'fiber_g': 0.0,
            'calcium_mg': 0.0,
            'iron_mg': 0.0,
            'zinc_mg': 0.0,
            'vitamin_a_mcg': 0.0,
            'vitamin_c_mg': 0.0,
            'vitamin_d_mcg': 0.0,
            'vitamin_b12_mcg': 0.0,
            'folate_mcg': 0.0,
        }
        return {
            'nutrients': {k: round(v or 0, 2) for k, v in nutrients.items()},
            'serving_g': round(float(serving or 0), 1),
            'actual_g': round(float(actual_serving or 0), 1),
            'portion_pct': portion_pct,
            'age_months': age_months,
            'formula': (
                f"Age serving {round(float(serving or 0), 1)}g × {portion_pct}% eaten "
                f"= {round(float(actual_serving or 0), 1)}g × (values per 100g)"
            ),
            'counted': portion_pct > 0 and bool(self.food),
            'nutrition_pending': bool(getattr(self.food, 'nutrition_pending', False)),
        }
    
    def to_dict(self):
        calc = self.get_nutrition_calculation()
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
            'effective_portion_eaten_percent': self.effective_portion_eaten_percent(),
            'is_adult_meal_adapted': self.is_adult_meal_adapted,
            'adult_meal_description': self.adult_meal_description,
            'toddler_reaction': self.toddler_reaction,
            'notes': self.notes,
            'photo_path': self.photo_path,
            'nutrients': calc['nutrients'] if calc else None,
            'nutrition_calculation': calc,
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
    # Most recent logged reaction — Preferences UI matches this
    last_reaction = db.Column(db.String(50), nullable=True)
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    food = db.relationship('Food', backref='preferences')

    REACTION_SCORES = {
        'loved': 2.0,
        'liked': 1.0,
        'neutral': 0.0,
        'disliked': -0.3,  # Mild penalty - still offer occasionally
        'refused': -0.5,   # Mild penalty - need more exposure, not less
    }
    
    def update_from_reaction(self, reaction):
        """
        Update preference based on meal reaction.
        
        IMPORTANT: We don't heavily penalize refused foods because:
        - Research shows 10-15 exposures needed for acceptance
        - Removing refused foods reinforces picky eating
        - We want to encourage continued exposure with accepted foods
        """
        reaction = (reaction or '').lower().strip()
        if reaction not in self.REACTION_SCORES:
            return

        score = self.REACTION_SCORES[reaction]
        self.last_reaction = reaction
        self.times_offered = (self.times_offered or 0) + 1
        if score > 0:
            self.times_accepted = (self.times_accepted or 0) + 1
        
        # First logged reaction should match the parent's choice immediately
        # (old 0.3 EMA left "loved" at 0.6 → Preferences showed Neutral).
        if self.times_offered <= 1:
            new_score = score
        else:
            weight = 0.55
            new_score = (1 - weight) * (self.preference_score or 0) + weight * score
        
        # Floor at -1 so refused foods still appear occasionally; cap at +2
        self.preference_score = max(min(new_score, 2.0), -1.0)
        self.last_offered = date.today()

    def display_bucket(self):
        """Preferences page bucket — prefer last reaction so UI matches logging."""
        reaction = (self.last_reaction or '').lower().strip()
        if reaction in ('loved', 'liked'):
            return 'liked'
        if reaction in ('disliked', 'refused'):
            return 'disliked'
        if reaction == 'neutral':
            return 'neutral'

        score = self.preference_score or 0
        if score >= 0.5:
            return 'liked'
        if score <= -0.3:
            return 'disliked'
        return 'neutral'
    
    def needs_reexposure(self):
        """
        Check if this food should be re-offered for exposure.
        Foods that were refused but haven't been offered in 3+ days should be tried again.
        """
        if self.preference_score >= 0:
            return False  # Already accepted
        
        if not self.last_offered:
            return True
        
        days_since_offered = (date.today() - self.last_offered).days
        
        # Re-offer refused foods every 3-5 days
        if self.preference_score < 0 and days_since_offered >= 3:
            return True
        
        return False
    
    def get_exposure_status(self):
        """Get exposure status for display"""
        reaction = (self.last_reaction or '').lower().strip()
        if reaction == 'loved':
            return 'loved'
        if reaction == 'liked':
            return 'accepted'
        if reaction in ('disliked', 'refused') and (self.times_offered or 0) < 15:
            return 'needs_exposure'
        if reaction in ('disliked', 'refused'):
            return 'challenging'

        if self.times_offered < 5:
            return 'new'  # Still introducing
        elif self.times_offered < 15 and self.preference_score < 0:
            return 'needs_exposure'  # Needs more tries (research: 10-15 exposures)
        elif self.preference_score >= 0.5:
            return 'accepted'
        elif self.preference_score >= 0:
            return 'neutral'
        else:
            return 'challenging'  # Offered 15+ times, still refused
    
    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'food_id': self.food_id,
            'food': self.food.to_dict() if self.food else None,
            'preference_score': round(self.preference_score, 2),
            'last_reaction': self.last_reaction,
            'display_bucket': self.display_bucket(),
            'times_offered': self.times_offered,
            'times_accepted': self.times_accepted,
            'acceptance_rate': round(self.times_accepted / self.times_offered * 100, 1) if self.times_offered > 0 else None,
            'last_offered': self.last_offered.isoformat() if self.last_offered else None,
            'needs_reexposure': self.needs_reexposure(),
            'exposure_status': self.get_exposure_status(),
            'exposures_remaining': max(0, 15 - self.times_offered) if self.preference_score < 0 else 0
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


class AuditLog(db.Model):
    """Per-toddler / system audit trail for plan changes and API mutations."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)

    action = db.Column(db.String(100), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id = db.Column(db.String(100), nullable=True)

    before_json = db.Column(JSON, nullable=True)
    after_json = db.Column(JSON, nullable=True)
    details = db.Column(JSON, nullable=True)

    source = db.Column(db.String(50), default='api')
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'toddler_id': self.toddler_id,
            'user_id': self.user_id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'before': self.before_json,
            'after': self.after_json,
            'details': self.details,
            'source': self.source,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AnalyticsEvent(db.Model):
    """First-party page views, session heartbeats, and named product actions."""
    __tablename__ = 'analytics_events'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    toddler_id = db.Column(db.Integer, db.ForeignKey('toddlers.id'), nullable=True, index=True)

    event_type = db.Column(db.String(30), nullable=False, index=True)  # page_view, heartbeat, page_leave, action
    path = db.Column(db.String(300), nullable=True, index=True)
    referrer = db.Column(db.String(500), nullable=True)
    duration_ms = db.Column(db.Integer, nullable=True)
    meta = db.Column(JSON, nullable=True)

    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'toddler_id': self.toddler_id,
            'event_type': self.event_type,
            'path': self.path,
            'referrer': self.referrer,
            'duration_ms': self.duration_ms,
            'meta': self.meta,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Recipe(db.Model):
    """Admin-authored recipes visible to all users (optional video + cover)."""
    __tablename__ = 'recipes'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(200), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), default='combo')
    why = db.Column(db.Text, nullable=True)
    cheese = db.Column(db.Text, nullable=True)
    steps = db.Column(db.Text, nullable=True)
    food_names = db.Column(JSON, default=list)
    allergens = db.Column(JSON, default=list)
    suitable_from_months = db.Column(db.Integer, nullable=True)

    cover_image_path = db.Column(db.String(500), nullable=True)
    video_url = db.Column(db.String(500), nullable=True)
    video_platform = db.Column(db.String(30), nullable=True)  # youtube | instagram | other

    is_published = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    source = db.Column(db.String(30), default='admin')
    created_by_email = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_public_dict(self):
        return {
            'id': self.slug,
            'db_id': self.id,
            'slug': self.slug,
            'name': self.name,
            'food_names': self.food_names or [self.name],
            'category': self.category or 'combo',
            'why': self.why or '',
            'cheese': self.cheese or '',
            'steps': self.steps or '',
            'source': self.source or 'admin',
            'allergens': self.allergens or [],
            'suitable_from_months': self.suitable_from_months,
            'cover_image_path': self.cover_image_path,
            'video_url': self.video_url,
            'video_platform': self.video_platform,
            'is_published': bool(self.is_published),
            'sort_order': self.sort_order or 0,
        }

    def to_admin_dict(self):
        d = self.to_public_dict()
        d['created_by_email'] = self.created_by_email
        d['created_at'] = self.created_at.isoformat() if self.created_at else None
        d['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return d


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
