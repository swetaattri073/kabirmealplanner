"""
Toddler Meal Planner - Main Flask Application
A personalized meal planning app for Indian toddlers
"""

import os
from datetime import date, datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, g
from flask_cors import CORS

from models import db, Toddler, Food, MealLog, FoodPreference, WeeklyPlan, NutritionAlert
from food_database import init_food_database, COMMON_ALLERGENS, FOOD_CATEGORIES
from nutrition_engine import NutritionEngine, adapt_adult_meal_for_toddler, NUTRIENT_INFO, RDA_BY_AGE
from meal_planner import MealPlanner, update_preferences_from_log

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'toddler-meal-planner-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///toddler_meals.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
CORS(app)

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
        'today': date.today().isoformat()
    }


# ==================== WEB ROUTES ====================

@app.route('/')
def index():
    """Home page - show dashboard or onboarding"""
    toddlers = Toddler.query.all()
    if not toddlers:
        return redirect(url_for('onboarding'))
    return render_template('dashboard.html', toddlers=toddlers)


@app.route('/onboarding')
def onboarding():
    """Onboarding page to add a toddler"""
    return render_template('onboarding.html', allergens=COMMON_ALLERGENS)


@app.route('/dashboard/<int:toddler_id>')
def dashboard(toddler_id):
    """Main dashboard for a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    return render_template('dashboard.html', toddler=toddler, toddlers=Toddler.query.all())


@app.route('/log-meal/<int:toddler_id>')
def log_meal_page(toddler_id):
    """Page to log a meal"""
    toddler = Toddler.query.get_or_404(toddler_id)
    foods = Food.query.filter(Food.suitable_from_months <= toddler.age_months).order_by(Food.name).all()
    return render_template('log_meal.html', toddler=toddler, foods=foods)


@app.route('/weekly-plan/<int:toddler_id>')
def weekly_plan_page(toddler_id):
    """Weekly meal plan page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    return render_template('weekly_plan.html', toddler=toddler)


@app.route('/nutrition/<int:toddler_id>')
def nutrition_page(toddler_id):
    """Nutrition analysis page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    engine = NutritionEngine(db.session)
    rda = engine.get_rda(toddler.age_months)
    return render_template('nutrition.html', toddler=toddler, rda=rda)


@app.route('/preferences/<int:toddler_id>')
def preferences_page(toddler_id):
    """Food preferences page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    return render_template('preferences.html', toddler=toddler)


# ==================== API ROUTES ====================

# --- Toddler Management ---

@app.route('/api/toddlers', methods=['GET'])
def get_toddlers():
    """Get all toddlers"""
    toddlers = Toddler.query.all()
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
        allergies=data.get('allergies', []),
        dietary_preference=data.get('dietary_preference', 'vegetarian'),
        meal_schedule=data.get('meal_schedule')
    )
    
    db.session.add(toddler)
    db.session.commit()
    
    return jsonify(toddler.to_dict()), 201


@app.route('/api/toddlers/<int:toddler_id>', methods=['GET'])
def get_toddler(toddler_id):
    """Get a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    return jsonify(toddler.to_dict())


@app.route('/api/toddlers/<int:toddler_id>', methods=['PUT'])
def update_toddler(toddler_id):
    """Update a toddler profile"""
    toddler = Toddler.query.get_or_404(toddler_id)
    data = request.json
    
    if 'name' in data:
        toddler.name = data['name']
    if 'age_months' in data:
        toddler.age_months = int(data['age_months'])
    if 'allergies' in data:
        toddler.allergies = data['allergies']
    if 'dietary_preference' in data:
        toddler.dietary_preference = data['dietary_preference']
    if 'meal_schedule' in data:
        toddler.meal_schedule = data['meal_schedule']
    
    db.session.commit()
    return jsonify(toddler.to_dict())


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
    """Adapt an adult meal for toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    data = request.json
    
    if not data.get('adult_meal'):
        return jsonify({'error': 'Adult meal description is required'}), 400
    
    adaptation = adapt_adult_meal_for_toddler(
        data['adult_meal'],
        db.session,
        toddler
    )
    
    return jsonify(adaptation)


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
