"""
Toddler Meal Planner - Main Flask Application
A personalized meal planning app for Indian toddlers
"""

import os
import secrets
from datetime import date, datetime, timedelta
from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, url_for, g, session, flash
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from models import db, User, Toddler, Food, MealLog, FoodPreference, WeeklyPlan, NutritionAlert
from food_database import init_food_database, COMMON_ALLERGENS, FOOD_CATEGORIES
from nutrition_engine import NutritionEngine, adapt_adult_meal_for_toddler, NUTRIENT_INFO, RDA_BY_AGE
from meal_planner import MealPlanner, update_preferences_from_log
from food_enhancer import (
    get_enhancement_suggestions, get_flavor_exploration, 
    get_daily_enhancement_tip, get_all_boosters, NUTRITION_BOOSTERS
)
from ai_features import (
    parse_meal_input, find_similar_foods, find_foods_by_features,
    smart_meal_parser, recognize_food_from_image
)

# Create Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'toddler-meal-planner-secret-key-change-in-production')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

# Database configuration - supports both SQLite and PostgreSQL
database_url = os.environ.get('DATABASE_URL', 'sqlite:///toddler_meals.db')
# Fix for Heroku PostgreSQL URL format
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url

# Initialize extensions
db.init_app(app)
CORS(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please sign in to access this feature.'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    return User.query.get(int(user_id))


def get_session_id():
    """Get or create a session ID for anonymous users"""
    if 'anonymous_session_id' not in session:
        session['anonymous_session_id'] = secrets.token_hex(32)
        session.permanent = True
    return session['anonymous_session_id']


def get_user_toddlers():
    """Get toddlers belonging to current user (logged in) or session (anonymous)"""
    if current_user.is_authenticated:
        return Toddler.query.filter_by(user_id=current_user.id).all()
    else:
        session_id = get_session_id()
        return Toddler.query.filter_by(session_id=session_id, user_id=None).all()


def owns_toddler(toddler):
    """Check if current user/session owns this toddler"""
    if current_user.is_authenticated:
        return toddler.user_id == current_user.id
    else:
        session_id = get_session_id()
        return toddler.session_id == session_id and toddler.user_id is None


# Initialize database and food data
with app.app_context():
    db.create_all()
    init_food_database(db.session, Food)


# Context processors for templates
@app.context_processor
def inject_globals():
    """Inject global variables into all templates"""
    return {
        'now': datetime.now,
        'today': date.today().isoformat(),
        'current_user': current_user,
        'is_authenticated': current_user.is_authenticated if current_user else False
    }


# ==================== AUTHENTICATION ROUTES ====================

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    """User registration page"""
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    if request.method == 'POST':
        data = request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        name = data.get('name', '').strip()
        
        # Validation
        errors = []
        if not email or '@' not in email:
            errors.append('Please enter a valid email address.')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters.')
        if password != confirm_password:
            errors.append('Passwords do not match.')
        if User.query.filter_by(email=email).first():
            errors.append('An account with this email already exists.')
        
        if errors:
            for error in errors:
                flash(error, 'error')
            return render_template('auth/signup.html', email=email, name=name)
        
        # Create user
        user = User(email=email, name=name or None)
        user.set_password(password)
        db.session.add(user)
        
        # Transfer any anonymous toddlers to this user
        session_id = session.get('anonymous_session_id')
        if session_id:
            anonymous_toddlers = Toddler.query.filter_by(
                session_id=session_id, 
                user_id=None
            ).all()
            for toddler in anonymous_toddlers:
                toddler.user_id = user.id
                toddler.session_id = None
        
        db.session.commit()
        
        # Log them in
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        flash('Account created successfully! Your data has been saved.', 'success')
        return redirect(url_for('home'))
    
    return render_template('auth/signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login page"""
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    if request.method == 'POST':
        data = request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember = data.get('remember', False)
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            if not user.is_active:
                flash('This account has been deactivated.', 'error')
                return render_template('auth/login.html', email=email)
            
            login_user(user, remember=bool(remember))
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            # Redirect to next page or home
            next_page = request.args.get('next')
            if next_page and next_page.startswith('/'):
                return redirect(next_page)
            return redirect(url_for('home'))
        else:
            flash('Invalid email or password.', 'error')
            return render_template('auth/login.html', email=email)
    
    return render_template('auth/login.html')


@app.route('/logout')
def logout():
    """Log out user"""
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))


@app.route('/profile')
@login_required
def profile():
    """User profile page"""
    toddlers = get_user_toddlers()
    return render_template('auth/profile.html', toddlers=toddlers)


@app.route('/api/auth/status')
def auth_status():
    """API endpoint to check authentication status"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict()
        })
    else:
        return jsonify({
            'authenticated': False,
            'session_id': get_session_id()[:8] + '...'  # Partial for privacy
        })


# ==================== WEB ROUTES ====================

@app.route('/')
def index():
    """Landing page - marketing page for new visitors"""
    return render_template('landing.html')


@app.route('/home')
def home():
    """Home page - show dashboard if toddlers exist"""
    toddlers = get_user_toddlers()
    if not toddlers:
        return redirect(url_for('onboarding'))
    return redirect(url_for('dashboard', toddler_id=toddlers[0].id))


@app.route('/onboarding')
def onboarding():
    """Onboarding page to add a toddler"""
    return render_template('onboarding.html', allergens=COMMON_ALLERGENS)


@app.route('/dashboard/<int:toddler_id>')
def dashboard(toddler_id):
    """Main dashboard for a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('dashboard.html', toddler=toddler, toddlers=toddlers)


@app.route('/log-meal/<int:toddler_id>')
def log_meal_page(toddler_id):
    """Page to log a meal"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    foods = Food.query.filter(Food.suitable_from_months <= toddler.age_months).order_by(Food.name).all()
    # Convert foods to dict for JSON serialization in template
    foods_data = [f.to_dict() for f in foods]
    toddlers = get_user_toddlers()
    return render_template('log_meal.html', toddler=toddler, toddlers=toddlers, foods=foods, foods_data=foods_data)


@app.route('/weekly-plan/<int:toddler_id>')
def weekly_plan_page(toddler_id):
    """Weekly meal plan page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('weekly_plan.html', toddler=toddler, toddlers=toddlers)


@app.route('/nutrition/<int:toddler_id>')
def nutrition_page(toddler_id):
    """Nutrition analysis page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    engine = NutritionEngine(db.session)
    rda = engine.get_rda(toddler.age_months)
    return render_template('nutrition.html', toddler=toddler, toddlers=toddlers, rda=rda)


@app.route('/preferences/<int:toddler_id>')
def preferences_page(toddler_id):
    """Food preferences page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('preferences.html', toddler=toddler, toddlers=toddlers)


# ==================== API ROUTES ====================

# --- Toddler Management ---

@app.route('/api/toddlers', methods=['GET'])
def get_toddlers():
    """Get all toddlers belonging to current user/session"""
    toddlers = get_user_toddlers()
    return jsonify([t.to_dict() for t in toddlers])


@app.route('/api/toddlers', methods=['POST'])
def create_toddler():
    """Create a new toddler profile"""
    data = request.json
    
    # Validate required fields
    if not data.get('name') or not data.get('age_months'):
        return jsonify({'error': 'Name and age are required'}), 400
    
    toddler = Toddler(
        name=data['name'],
        age_months=int(data['age_months']),
        birth_date=datetime.strptime(data['birth_date'], '%Y-%m-%d').date() if data.get('birth_date') else None,
        gender=data.get('gender', 'unknown'),
        weight_kg=data.get('weight_kg'),
        height_cm=data.get('height_cm'),
        activity_level=data.get('activity_level', 'moderate'),
        health_conditions=data.get('health_conditions', []),
        health_notes=data.get('health_notes'),
        allergies=data.get('allergies', []),
        dietary_preference=data.get('dietary_preference', 'vegetarian'),
        meal_schedule=data.get('meal_schedule')
    )
    
    # Assign ownership
    if current_user.is_authenticated:
        toddler.user_id = current_user.id
    else:
        toddler.session_id = get_session_id()
    
    if toddler.weight_kg:
        toddler.weight_updated_at = date.today()
    
    db.session.add(toddler)
    db.session.commit()
    
    return jsonify(toddler.to_dict()), 201


@app.route('/api/toddlers/<int:toddler_id>', methods=['GET'])
def get_toddler(toddler_id):
    """Get a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    return jsonify(toddler.to_dict())


@app.route('/api/toddlers/<int:toddler_id>', methods=['PUT'])
def update_toddler(toddler_id):
    """Update a toddler profile"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    data = request.json
    
    if 'name' in data:
        toddler.name = data['name']
    if 'age_months' in data:
        toddler.age_months = int(data['age_months'])
    if 'gender' in data:
        toddler.gender = data['gender']
    if 'weight_kg' in data:
        toddler.weight_kg = data['weight_kg']
        toddler.weight_updated_at = date.today()
    if 'height_cm' in data:
        toddler.height_cm = data['height_cm']
    if 'activity_level' in data:
        toddler.activity_level = data['activity_level']
    if 'health_conditions' in data:
        toddler.health_conditions = data['health_conditions']
    if 'health_notes' in data:
        toddler.health_notes = data['health_notes']
    if 'allergies' in data:
        toddler.allergies = data['allergies']
    if 'dietary_preference' in data:
        toddler.dietary_preference = data['dietary_preference']
    if 'meal_schedule' in data:
        toddler.meal_schedule = data['meal_schedule']
    
    db.session.commit()
    return jsonify(toddler.to_dict())


@app.route('/api/toddlers/<int:toddler_id>/health', methods=['PUT'])
def update_toddler_health(toddler_id):
    """Update toddler's health information"""
    toddler = Toddler.query.get_or_404(toddler_id)
    data = request.json
    
    if 'weight_kg' in data:
        toddler.weight_kg = data['weight_kg']
        toddler.weight_updated_at = date.today()
    if 'height_cm' in data:
        toddler.height_cm = data['height_cm']
    if 'activity_level' in data:
        toddler.activity_level = data['activity_level']
    if 'health_conditions' in data:
        toddler.health_conditions = data['health_conditions']
    if 'health_notes' in data:
        toddler.health_notes = data['health_notes']
    
    db.session.commit()
    
    # Return updated info with weight status
    return jsonify({
        'toddler_id': toddler.id,
        'weight_kg': toddler.weight_kg,
        'height_cm': toddler.height_cm,
        'weight_status': toddler.get_weight_status(),
        'activity_level': toddler.activity_level,
        'health_conditions': toddler.health_conditions,
        'calorie_adjustment': toddler.get_calorie_adjustment(),
        'nutrition_priorities': toddler.get_nutrition_priorities()
    })


@app.route('/api/toddlers/<int:toddler_id>', methods=['DELETE'])
def delete_toddler(toddler_id):
    """Delete a toddler profile"""
    toddler = Toddler.query.get_or_404(toddler_id)
    db.session.delete(toddler)
    db.session.commit()
    return jsonify({'message': 'Toddler deleted successfully'})


# --- Food Database ---

@app.route('/api/foods', methods=['GET'])
def get_foods():
    """Get all foods with optional filtering"""
    category = request.args.get('category')
    search = request.args.get('search')
    age_months = request.args.get('age_months', type=int)
    
    query = Food.query
    
    if category:
        query = query.filter(Food.category == category)
    
    if age_months:
        query = query.filter(Food.suitable_from_months <= age_months)
    
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Food.name.ilike(search_term),
                Food.name_hindi.ilike(search_term)
            )
        )
    
    foods = query.order_by(Food.name).all()
    return jsonify([f.to_dict() for f in foods])


@app.route('/api/foods/<int:food_id>', methods=['GET'])
def get_food(food_id):
    """Get a specific food"""
    food = Food.query.get_or_404(food_id)
    return jsonify(food.to_dict())


@app.route('/api/foods/categories', methods=['GET'])
def get_food_categories():
    """Get all food categories"""
    return jsonify(FOOD_CATEGORIES)


@app.route('/api/foods/allergens', methods=['GET'])
def get_allergens():
    """Get all common allergens"""
    return jsonify(COMMON_ALLERGENS)


@app.route('/api/foods/status', methods=['GET'])
def get_foods_status():
    """Check food database status"""
    from food_database import INDIAN_FOODS
    
    current_count = Food.query.count()
    expected_count = len(INDIAN_FOODS)
    
    # Get count by category
    categories = db.session.query(
        Food.category, db.func.count(Food.id)
    ).group_by(Food.category).all()
    
    return jsonify({
        'current_count': current_count,
        'expected_count': expected_count,
        'is_complete': current_count >= expected_count * 0.9,
        'categories': {cat: count for cat, count in categories}
    })


@app.route('/api/foods/reseed', methods=['POST'])
def reseed_foods():
    """Force re-seed the food database"""
    from food_database import INDIAN_FOODS
    
    # Delete all existing foods
    Food.query.delete()
    db.session.commit()
    
    # Re-seed
    init_food_database(db.session, Food, force_reseed=True)
    
    new_count = Food.query.count()
    
    return jsonify({
        'success': True,
        'message': f'Food database re-seeded with {new_count} foods',
        'count': new_count
    })


# --- Meal Logging ---

@app.route('/api/meal-logs', methods=['GET'])
def get_meal_logs():
    """Get meal logs with optional filtering"""
    toddler_id = request.args.get('toddler_id', type=int)
    date_str = request.args.get('date')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = MealLog.query
    
    if toddler_id:
        query = query.filter(MealLog.toddler_id == toddler_id)
    
    if date_str:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        query = query.filter(MealLog.date == target_date)
    
    if start_date:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        query = query.filter(MealLog.date >= start)
    
    if end_date:
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        query = query.filter(MealLog.date <= end)
    
    logs = query.order_by(MealLog.date.desc(), MealLog.created_at.desc()).all()
    return jsonify([l.to_dict() for l in logs])


@app.route('/api/meal-logs', methods=['POST'])
def create_meal_log():
    """Log a meal"""
    data = request.json
    
    if not data.get('toddler_id') or not data.get('meal_type'):
        return jsonify({'error': 'Toddler ID and meal type are required'}), 400
    
    toddler = Toddler.query.get_or_404(data['toddler_id'])
    
    log = MealLog(
        toddler_id=toddler.id,
        food_id=data.get('food_id'),
        date=datetime.strptime(data.get('date', date.today().isoformat()), '%Y-%m-%d').date(),
        meal_type=data['meal_type'],
        custom_food_name=data.get('custom_food_name'),
        portion_offered_g=data.get('portion_offered_g'),
        portion_eaten_percent=data.get('portion_eaten_percent', 100),
        is_adult_meal_adapted=data.get('is_adult_meal_adapted', False),
        adult_meal_description=data.get('adult_meal_description'),
        toddler_reaction=data.get('toddler_reaction'),
        notes=data.get('notes')
    )
    
    db.session.add(log)
    db.session.commit()
    
    # Update preferences if reaction provided
    if log.toddler_reaction and log.food_id:
        update_preferences_from_log(db.session, log)
    
    return jsonify(log.to_dict()), 201


@app.route('/api/meal-logs/<int:log_id>', methods=['PUT'])
def update_meal_log(log_id):
    """Update a meal log"""
    log = MealLog.query.get_or_404(log_id)
    data = request.json
    
    if 'food_id' in data:
        log.food_id = data['food_id']
    if 'portion_eaten_percent' in data:
        log.portion_eaten_percent = data['portion_eaten_percent']
    if 'toddler_reaction' in data:
        log.toddler_reaction = data['toddler_reaction']
    if 'notes' in data:
        log.notes = data['notes']
    
    db.session.commit()
    
    # Update preferences
    if log.toddler_reaction and log.food_id:
        update_preferences_from_log(db.session, log)
    
    return jsonify(log.to_dict())


@app.route('/api/meal-logs/<int:log_id>', methods=['DELETE'])
def delete_meal_log(log_id):
    """Delete a meal log"""
    log = MealLog.query.get_or_404(log_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Meal log deleted successfully'})


# --- Nutrition Analysis ---

@app.route('/api/nutrition/daily/<int:toddler_id>', methods=['GET'])
def get_daily_nutrition(toddler_id):
    """Get daily nutrition status"""
    toddler = Toddler.query.get_or_404(toddler_id)
    date_str = request.args.get('date', date.today().isoformat())
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    
    engine = NutritionEngine(db.session)
    status = engine.get_nutrition_status(toddler, target_date)
    
    return jsonify({
        'toddler_id': toddler_id,
        'date': target_date.isoformat(),
        'age_months': toddler.age_months,
        'nutrition': status
    })


@app.route('/api/nutrition/weekly/<int:toddler_id>', methods=['GET'])
def get_weekly_nutrition(toddler_id):
    """Get weekly nutrition analysis"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    week_start_str = request.args.get('week_start')
    if week_start_str:
        week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
    else:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    
    engine = NutritionEngine(db.session)
    weekly = engine.get_weekly_nutrition(toddler, week_start)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        **weekly
    })


@app.route('/api/nutrition/alerts/<int:toddler_id>', methods=['GET'])
def get_nutrition_alerts(toddler_id):
    """Get nutrition alerts and recommendations"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    engine = NutritionEngine(db.session)
    alerts = engine.generate_alerts(toddler)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        'alerts': alerts
    })


@app.route('/api/nutrition/rda/<int:age_months>', methods=['GET'])
def get_rda(age_months):
    """Get RDA for a specific age"""
    engine = NutritionEngine(db.session)
    rda = engine.get_rda(age_months)
    
    return jsonify({
        'age_months': age_months,
        'rda': rda,
        'nutrient_info': NUTRIENT_INFO
    })


# --- Meal Planning ---

@app.route('/api/meal-plan/weekly/<int:toddler_id>', methods=['GET'])
def get_weekly_plan(toddler_id):
    """Get or generate weekly meal plan"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    week_start_str = request.args.get('week_start')
    if week_start_str:
        week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
    else:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    
    regenerate = request.args.get('regenerate', 'false').lower() == 'true'
    
    planner = MealPlanner(db.session)
    plan = planner.generate_weekly_plan(toddler, week_start, regenerate)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        **plan
    })


@app.route('/api/meal-plan/daily/<int:toddler_id>', methods=['GET'])
def get_daily_suggestions(toddler_id):
    """Get daily meal suggestions"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    date_str = request.args.get('date', date.today().isoformat())
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    
    planner = MealPlanner(db.session)
    suggestions = planner.get_daily_suggestions(toddler, target_date)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        **suggestions
    })


@app.route('/api/meal-plan/item/<int:plan_id>', methods=['PUT'])
def update_plan_item(plan_id):
    """Update a specific item in the meal plan"""
    data = request.json
    
    if not data.get('food_id'):
        return jsonify({'error': 'Food ID is required'}), 400
    
    planner = MealPlanner(db.session)
    updated = planner.update_plan_item(plan_id, data['food_id'])
    
    if not updated:
        return jsonify({'error': 'Plan item not found'}), 404
    
    return jsonify(updated)


# --- Adult Meal Adaptation ---

@app.route('/api/adapt-meal/<int:toddler_id>', methods=['POST'])
def adapt_meal(toddler_id):
    """
    Adapt an adult meal for toddler.
    
    Parameters:
    - adult_meal: Description of what adults are eating (required)
    - meal_type: 'lunch' or 'dinner' (optional, default: 'lunch')
    - add_to_plan: If true, add the adapted meal to today's plan (optional)
    - selected_food_id: Specific food ID to use (optional, used with add_to_plan)
    
    Returns adaptation suggestions and optionally adds to plan.
    """
    toddler = Toddler.query.get_or_404(toddler_id)
    data = request.json
    
    if not data.get('adult_meal'):
        return jsonify({'error': 'Adult meal description is required'}), 400
    
    # Get adaptation suggestions
    adaptation = adapt_adult_meal_for_toddler(
        data['adult_meal'],
        db.session,
        toddler
    )
    
    # If user wants to add to today's plan
    if data.get('add_to_plan') and adaptation.get('matched_foods'):
        meal_type = data.get('meal_type', 'lunch')
        selected_food_id = data.get('selected_food_id')
        
        # Use selected food or first matched food
        if selected_food_id:
            selected_food = Food.query.get(selected_food_id)
        else:
            selected_food = Food.query.get(adaptation['matched_foods'][0]['food_id'])
        
        if selected_food:
            result = _add_adult_meal_to_plan(
                toddler, 
                selected_food, 
                meal_type, 
                data['adult_meal'],
                adaptation
            )
            adaptation['added_to_plan'] = result
    
    return jsonify(adaptation)


def _add_adult_meal_to_plan(toddler, food, meal_type, adult_meal_description, adaptation):
    """
    Add an adapted adult meal to today's plan and log.
    Also updates weekly plan to avoid repetition.
    """
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    
    # 1. Log the meal for today
    log = MealLog(
        toddler_id=toddler.id,
        food_id=food.id,
        date=today,
        meal_type=meal_type,
        is_adult_meal_adapted=True,
        adult_meal_description=adult_meal_description,
        notes=f"Adapted from adult meal. Tips: {'; '.join(adaptation.get('general_tips', [])[:2])}"
    )
    db.session.add(log)
    
    # 2. Update or create today's weekly plan entry
    existing_plan = WeeklyPlan.query.filter(
        WeeklyPlan.toddler_id == toddler.id,
        WeeklyPlan.week_start == week_start,
        WeeklyPlan.day_of_week == today.weekday(),
        WeeklyPlan.meal_type == meal_type
    ).first()
    
    if existing_plan:
        # Update existing plan
        existing_plan.food_id = food.id
        existing_plan.is_generated = False
        existing_plan.nutrition_reason = f"Adapted from: {adult_meal_description[:50]}"
    else:
        # Create new plan entry
        new_plan = WeeklyPlan(
            toddler_id=toddler.id,
            week_start=week_start,
            day_of_week=today.weekday(),
            meal_type=meal_type,
            food_id=food.id,
            is_generated=False,
            nutrition_reason=f"Adapted from: {adult_meal_description[:50]}"
        )
        db.session.add(new_plan)
    
    # 3. Check future plans this week and avoid same food too soon
    future_plans = WeeklyPlan.query.filter(
        WeeklyPlan.toddler_id == toddler.id,
        WeeklyPlan.week_start == week_start,
        WeeklyPlan.day_of_week > today.weekday(),
        WeeklyPlan.food_id == food.id
    ).all()
    
    # If same food appears in next 2 days, regenerate those entries
    foods_to_swap = []
    for plan in future_plans:
        if plan.day_of_week <= today.weekday() + 2:
            foods_to_swap.append(plan)
    
    # Get alternative foods for swapping
    if foods_to_swap:
        planner = MealPlanner(db.session)
        suitable_foods = planner._get_suitable_foods(toddler)
        
        for plan in foods_to_swap:
            # Find an alternative food from same category
            current_food = Food.query.get(plan.food_id)
            alternatives = [f for f in suitable_foods 
                          if f.category == current_food.category 
                          and f.id != food.id 
                          and f.id != current_food.id]
            
            if alternatives:
                import random
                new_food = random.choice(alternatives)
                plan.food_id = new_food.id
                plan.nutrition_reason = f"Swapped to avoid repetition (was: {current_food.name})"
    
    db.session.commit()
    
    return {
        'logged': True,
        'food_name': food.name,
        'meal_type': meal_type,
        'date': today.isoformat(),
        'plans_adjusted': len(foods_to_swap),
        'tips': adaptation.get('general_tips', [])[:2]
    }


# --- Food Preferences ---

@app.route('/api/preferences/<int:toddler_id>', methods=['GET'])
def get_preferences(toddler_id):
    """Get food preferences for a toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    preferences = FoodPreference.query.filter_by(toddler_id=toddler_id).all()
    
    # Categorize by preference
    liked = [p.to_dict() for p in preferences if p.preference_score >= 1]
    neutral = [p.to_dict() for p in preferences if -1 < p.preference_score < 1]
    disliked = [p.to_dict() for p in preferences if p.preference_score <= -1]
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        'liked': sorted(liked, key=lambda x: x['preference_score'], reverse=True),
        'neutral': neutral,
        'disliked': sorted(disliked, key=lambda x: x['preference_score']),
        'total': len(preferences)
    })


@app.route('/api/preferences/<int:toddler_id>/<int:food_id>', methods=['PUT'])
def update_preference(toddler_id, food_id):
    """Manually update a food preference"""
    data = request.json
    
    pref = FoodPreference.query.filter_by(
        toddler_id=toddler_id,
        food_id=food_id
    ).first()
    
    if not pref:
        pref = FoodPreference(
            toddler_id=toddler_id,
            food_id=food_id
        )
        db.session.add(pref)
    
    if 'preference_score' in data:
        pref.preference_score = data['preference_score']
    
    db.session.commit()
    return jsonify(pref.to_dict())


# --- Food Enhancement & Flavor Exploration ---

@app.route('/api/enhance/<int:toddler_id>', methods=['GET'])
def get_food_enhancements(toddler_id):
    """Get enhancement suggestions for a specific food"""
    toddler = Toddler.query.get_or_404(toddler_id)
    food_name = request.args.get('food')
    
    if not food_name:
        return jsonify({'error': 'Food name is required'}), 400
    
    suggestions = get_enhancement_suggestions(food_name, toddler)
    return jsonify(suggestions)


@app.route('/api/enhance/liked/<int:toddler_id>', methods=['GET'])
def get_liked_food_enhancements(toddler_id):
    """Get enhancement suggestions for all liked foods"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    # Get liked foods
    prefs = FoodPreference.query.filter(
        FoodPreference.toddler_id == toddler_id,
        FoodPreference.preference_score >= 1
    ).all()
    
    enhancements = []
    for pref in prefs:
        if pref.food:
            suggestions = get_enhancement_suggestions(pref.food.name, toddler)
            if suggestions.get('boosts') or suggestions.get('flavor_variations'):
                enhancements.append({
                    'food': pref.food.to_dict(),
                    'preference_score': pref.preference_score,
                    'enhancements': suggestions
                })
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        'liked_foods_with_enhancements': enhancements
    })


@app.route('/api/explore-flavors/<int:toddler_id>', methods=['GET'])
def explore_flavors(toddler_id):
    """Get flavor exploration suggestions based on liked foods"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    # Get liked foods
    prefs = FoodPreference.query.filter(
        FoodPreference.toddler_id == toddler_id,
        FoodPreference.preference_score >= 0.5
    ).all()
    
    liked_foods = [{'name': p.food.name, 'score': p.preference_score} 
                   for p in prefs if p.food]
    
    exploration = get_flavor_exploration(liked_foods, toddler)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        **exploration
    })


@app.route('/api/daily-tip/<int:toddler_id>', methods=['GET'])
def get_daily_tip(toddler_id):
    """Get a daily enhancement tip"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    # Get liked foods
    prefs = FoodPreference.query.filter(
        FoodPreference.toddler_id == toddler_id,
        FoodPreference.preference_score >= 1
    ).all()
    
    liked_foods = [{'name': p.food.name} for p in prefs if p.food]
    
    tip = get_daily_enhancement_tip(toddler, liked_foods)
    
    if not tip:
        # Fallback generic tip
        tip = {
            'tip_type': 'general',
            'title': 'Nutrition Tip',
            'method': 'Add ghee to meals',
            'benefit': 'Healthy fats for brain development',
            'how': 'Add 1 tsp ghee to dal, rice, or rotis'
        }
    
    return jsonify({
        'toddler_id': toddler_id,
        'tip': tip
    })


@app.route('/api/nutrition-boosters', methods=['GET'])
def get_nutrition_boosters():
    """Get all nutrition boosters organized by nutrient"""
    return jsonify(get_all_boosters())


# --- AI Features: Natural Language & Similarity ---

@app.route('/api/parse-meal', methods=['POST'])
def parse_meal_text():
    """
    Parse natural language meal description into structured data.
    
    Example input:
    {
        "text": "He had some rice and dal with ghee for lunch, ate about half, loved the rice"
    }
    
    Returns parsed foods, portion, meal type, and reactions.
    """
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    
    # Get food database for better matching
    foods = Food.query.all()
    food_list = [{'name': f.name, 'id': f.id} for f in foods]
    
    result = parse_meal_input(text, food_list)
    
    # Enhance with food IDs from database
    for food in result['foods']:
        db_food = Food.query.filter(Food.name.ilike(f"%{food['name']}%")).first()
        if db_food:
            food['food_id'] = db_food.id
            food['db_name'] = db_food.name
    
    return jsonify(result)


@app.route('/api/smart-log', methods=['POST'])
def smart_meal_log():
    """
    Smart meal logging using natural language.
    Parses text, creates meal log entries automatically.
    
    Example input:
    {
        "toddler_id": 1,
        "text": "Arjun had idli and sambar for breakfast, ate most of it and loved it"
    }
    """
    data = request.json
    toddler_id = data.get('toddler_id')
    text = data.get('text', '')
    
    if not toddler_id or not text:
        return jsonify({'error': 'toddler_id and text are required'}), 400
    
    toddler = Toddler.query.get_or_404(toddler_id)
    
    # Get food database
    foods = Food.query.filter(Food.suitable_from_months <= toddler.age_months).all()
    food_list = [{'name': f.name, 'id': f.id} for f in foods]
    
    # Parse the input
    parsed = parse_meal_input(text, food_list)
    
    # Create meal logs
    created_logs = []
    meal_type = parsed['meal_type'] or 'lunch'  # Default to lunch if not specified
    
    for food_info in parsed['foods']:
        # Find food in database
        db_food = None
        for f in foods:
            if f.name.lower() == food_info['name'].lower() or \
               food_info['name'].lower() in f.name.lower():
                db_food = f
                break
        
        # Determine portion
        portion = 100
        if parsed['portion']['type'] == 'percentage':
            portion = parsed['portion']['value']
        elif parsed['portion']['value'] == 'small':
            portion = 50
        elif parsed['portion']['value'] == 'large':
            portion = 100
        
        # Determine reaction
        reaction = parsed['food_reactions'].get(food_info['name']) or parsed['overall_reaction']
        
        log = MealLog(
            toddler_id=toddler.id,
            food_id=db_food.id if db_food else None,
            custom_food_name=food_info['name'] if not db_food else None,
            date=date.today(),
            meal_type=meal_type,
            portion_eaten_percent=portion,
            toddler_reaction=reaction,
            notes=f"Logged via natural language: '{text[:100]}...'" if len(text) > 100 else f"Logged via natural language: '{text}'"
        )
        
        db.session.add(log)
        created_logs.append(log)
        
        # Update preferences if reaction provided
        if reaction and db_food:
            from meal_planner import update_preferences_from_log
            db.session.flush()  # Get log ID
            update_preferences_from_log(db.session, log)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'parsed': parsed,
        'created_logs': [log.to_dict() for log in created_logs],
        'message': f"Created {len(created_logs)} meal log(s) for {toddler.name}"
    }), 201


@app.route('/api/similar-foods/<food_name>', methods=['GET'])
def get_similar_foods(food_name):
    """
    Find foods similar to the given food.
    Useful for suggesting alternatives or new foods to try.
    """
    top_n = request.args.get('top', 5, type=int)
    
    similar = find_similar_foods(food_name, top_n=top_n)
    
    # Enhance with database info
    for item in similar:
        db_food = Food.query.filter(Food.name.ilike(f"%{item['food']}%")).first()
        if db_food:
            item['food_id'] = db_food.id
            item['full_name'] = db_food.name
            item['category'] = db_food.category
    
    return jsonify({
        'query': food_name,
        'similar_foods': similar
    })


@app.route('/api/find-foods', methods=['POST'])
def find_foods_matching():
    """
    Find foods matching specific features/preferences.
    
    Example input:
    {
        "preferences": {
            "soft": true,
            "sweet": true,
            "fruit": true
        }
    }
    """
    data = request.json
    preferences = data.get('preferences', {})
    top_n = data.get('top', 5)
    
    if not preferences:
        return jsonify({'error': 'preferences object is required'}), 400
    
    matches = find_foods_by_features(preferences, top_n=top_n)
    
    # Enhance with database info
    for item in matches:
        db_food = Food.query.filter(Food.name.ilike(f"%{item['food']}%")).first()
        if db_food:
            item['food_id'] = db_food.id
            item['full_name'] = db_food.name
            item['category'] = db_food.category
            item['nutrients'] = {
                'calories': db_food.calories,
                'protein': db_food.protein_g,
                'iron': db_food.iron_mg
            }
    
    return jsonify({
        'preferences': preferences,
        'matching_foods': matches
    })


@app.route('/api/recognize-food', methods=['POST'])
def recognize_food():
    """
    Placeholder for image-based food recognition.
    
    In production, image processing would happen client-side using TensorFlow.js,
    and this endpoint would just receive the predictions for logging.
    
    For now, returns instructions for setting up image recognition.
    """
    # Check if image data is provided
    image_data = request.json.get('image') if request.is_json else None
    predictions = request.json.get('predictions') if request.is_json else None
    
    if predictions:
        # Client-side recognition was done, process predictions
        foods_detected = []
        for pred in predictions:
            db_food = Food.query.filter(Food.name.ilike(f"%{pred['class']}%")).first()
            if db_food:
                foods_detected.append({
                    'name': db_food.name,
                    'food_id': db_food.id,
                    'confidence': pred['confidence']
                })
        
        return jsonify({
            'status': 'success',
            'detected_foods': foods_detected
        })
    
    # Return setup instructions
    return jsonify({
        'status': 'setup_required',
        'message': 'Image recognition runs client-side for privacy and offline support',
        'setup': {
            'web': {
                'library': 'TensorFlow.js',
                'model_url': '/static/models/indian_food_classifier/model.json',
                'instructions': 'Load model with tf.loadLayersModel(), preprocess image to 224x224, run predict()'
            },
            'mobile': {
                'android': 'Use TFLite with indian_food_classifier.tflite',
                'ios': 'Use CoreML with indian_food_classifier.mlmodel'
            },
            'supported_foods': [
                'rice', 'roti', 'paratha', 'idli', 'dosa', 'upma', 'poha', 'khichdi',
                'dal', 'sambar', 'chole', 'rajma', 'paneer', 'sabzi', 'raita',
                'banana', 'apple', 'mango', 'orange', 'curd', 'milk', 'egg'
            ]
        }
    })


# --- Dashboard Data ---

@app.route('/api/dashboard/<int:toddler_id>', methods=['GET'])
def get_dashboard_data(toddler_id):
    """Get all dashboard data in one call"""
    toddler = Toddler.query.get_or_404(toddler_id)
    today = date.today()
    
    # Today's meals
    today_logs = MealLog.query.filter(
        MealLog.toddler_id == toddler_id,
        MealLog.date == today
    ).all()
    
    # Nutrition status
    engine = NutritionEngine(db.session)
    nutrition = engine.get_nutrition_status(toddler, today)
    
    # Alerts
    alerts = engine.generate_alerts(toddler)
    
    # Daily suggestions
    planner = MealPlanner(db.session)
    suggestions = planner.get_daily_suggestions(toddler, today)
    
    # Schedule
    schedule = toddler.get_recommended_schedule()
    all_meals = schedule['meals'] + schedule['snacks']
    eaten_meals = set(log.meal_type for log in today_logs)
    
    return jsonify({
        'toddler': toddler.to_dict(),
        'today': today.isoformat(),
        'schedule': schedule,
        'meals_eaten': list(eaten_meals),
        'meals_remaining': [m for m in all_meals if m not in eaten_meals],
        'today_logs': [l.to_dict() for l in today_logs],
        'nutrition': nutrition,
        'alerts': alerts[:3],  # Top 3 alerts
        'suggestions': suggestions.get('suggestions', {})
    })


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Resource not found'}), 404
    return render_template('404.html'), 404


@app.errorhandler(500)
def server_error(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('500.html'), 500


# ==================== RUN APP ====================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
