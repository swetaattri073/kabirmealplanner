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
from werkzeug.middleware.proxy_fix import ProxyFix

# Resolve paths early so secrets on the Docker data volume are picked up.
# Production: -v ~/meal-data:/app/instance  →  put secrets in ~/meal-data/.env
# Local dev: also supports toddler-meal-planner/.env
_APP_DIR = os.path.abspath(os.path.dirname(__file__))
_INSTANCE_DIR = os.path.join(_APP_DIR, 'instance')
os.makedirs(_INSTANCE_DIR, exist_ok=True)

# Project .env first (local/dev), then instance/.env (persistent Docker volume) wins.
load_dotenv(os.path.join(_APP_DIR, '.env'))
load_dotenv(os.path.join(_INSTANCE_DIR, '.env'), override=True)

from session_persist import (
    GUEST_COOKIE_MAX_AGE,
    GUEST_COOKIE_NAME,
    cookie_secure_for_request,
    ensure_persistent_secret_key,
    is_valid_guest_id,
    new_guest_id,
)
from toddler_refs import (
    ToddlerRefConverter,
    configure_toddler_refs,
    encode_toddler_ref,
    resolve_toddler_id,
)

from models import db, User, Toddler, Food, MealLog, FoodPreference, WeeklyPlan, NutritionAlert, AuditLog, AnalyticsEvent, Recipe
from admin_stats import build_admin_stats
from analytics import record_analytics_event
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
from nutrient_lookup import lookup_nutrients, guess_category
from food_safety import check_food_safety, check_foods_safety, safety_rules_for_prompt
from chat_assistant import (
    LOG_FOOD_FEEDBACK_TOOL,
    UPDATE_WEEKLY_PLAN_TOOL,
    CHAT_TOOLS,
    build_system_prompt,
    find_matching_food,
)
from chat_service import call_openai_chat, chat_configured, ChatConfigError, ChatRequestError, summarize_chat_history
from recipes import list_recipes, get_recipe, find_recipe_for_food_name, slugify_recipe_name, detect_video_platform, youtube_embed_url
from usda_lookup import search_foods as usda_search_foods, get_food as usda_get_food, using_demo_key as usda_using_demo_key
from audit_logging import setup_logging, write_audit_log, app_log, request_payload_snapshot
import json as _json
import shutil
from pathlib import Path
import base64
import re as _re

# Create Flask app
app = Flask(__name__)

# Trust reverse-proxy HTTPS headers (nginx / Cloudflare / Lightsail).
# Without this, request.is_secure stays False behind TLS termination and
# cookie Secure flags / redirects behave incorrectly.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Configuration — persist SECRET_KEY on the data volume so redeploys don't
# wipe Flask sessions (which made guest onboarding look "reset").
app.config['SECRET_KEY'] = ensure_persistent_secret_key(_INSTANCE_DIR)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Session cookies: only set Secure when HTTPS is actually used.
# Docker commonly serves over HTTP (port 80) with FLASK_ENV=production —
# Secure cookies then never stick on mobile, so onboarding appears to "reset".
_secure_flag = os.environ.get('SESSION_COOKIE_SECURE', '').strip().lower()
if _secure_flag in ('1', 'true', 'yes'):
    app.config['SESSION_COOKIE_SECURE'] = True
elif _secure_flag in ('0', 'false', 'no'):
    app.config['SESSION_COOKIE_SECURE'] = False
else:
    # Default off for HTTP deploys; set SESSION_COOKIE_SECURE=true behind HTTPS
    app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_NAME'] = 'lb_session'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=400)
# Flask-Login "remember me" — keep parents signed in across PWA reopen
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=400)
app.config['REMEMBER_COOKIE_HTTPONLY'] = True
app.config['REMEMBER_COOKIE_SAMESITE'] = 'Lax'
app.config['REMEMBER_COOKIE_SECURE'] = app.config['SESSION_COOKIE_SECURE']
app.config['REMEMBER_COOKIE_NAME'] = 'lb_remember'

# Opaque toddler IDs in URLs (signed tokens, not sequential integers)
configure_toddler_refs(app.config['SECRET_KEY'])
app.url_map.converters['toddler_ref'] = ToddlerRefConverter

# Database configuration - supports both SQLite and PostgreSQL.
# SQLite defaults to instance/toddler_meals.db so Docker volume mounts at
# /app/instance (e.g. -v ~/meal-data:/app/instance) persist users + meal history
# across rebuilds/redeploys.
_DEFAULT_SQLITE = 'sqlite:///' + os.path.join(_INSTANCE_DIR, 'toddler_meals.db')
# One-time migrate from older CWD-relative DB path if present
_legacy_db = os.path.join(_APP_DIR, 'toddler_meals.db')
_instance_db = os.path.join(_INSTANCE_DIR, 'toddler_meals.db')
if os.path.exists(_legacy_db) and not os.path.exists(_instance_db):
    try:
        shutil.copy2(_legacy_db, _instance_db)
    except OSError:
        pass

database_url = os.environ.get('DATABASE_URL', _DEFAULT_SQLITE)
# Fix for Heroku PostgreSQL URL format
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url

# Initialize extensions
db.init_app(app)
CORS(app)
setup_logging(_INSTANCE_DIR)

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
    """Get or create a session ID for anonymous users.

    Restores from the durable lb_guest_id cookie when the Flask session was
    dropped (common on mobile PWAs / HTTP cookie issues).
    """
    if 'anonymous_session_id' not in session:
        cookie_id = request.cookies.get(GUEST_COOKIE_NAME)
        if is_valid_guest_id(cookie_id):
            session['anonymous_session_id'] = cookie_id
        else:
            session['anonymous_session_id'] = new_guest_id()
        session.permanent = True
        session.modified = True
    g._refresh_guest_cookie = session['anonymous_session_id']
    return session['anonymous_session_id']


def adopt_guest_id(guest_id: str) -> str:
    """Force the current anonymous session to use a known guest id."""
    if not is_valid_guest_id(guest_id):
        raise ValueError('invalid guest id')
    session.permanent = True
    session['anonymous_session_id'] = guest_id
    session.modified = True
    g._refresh_guest_cookie = guest_id
    return guest_id


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


def _transfer_anonymous_toddlers(user):
    """Move guest session toddlers to a newly logged-in/signed-up user"""
    session_id = session.get('anonymous_session_id') or request.cookies.get(GUEST_COOKIE_NAME)
    if not session_id:
        return 0
    anonymous_toddlers = Toddler.query.filter_by(
        session_id=session_id,
        user_id=None
    ).all()
    for toddler in anonymous_toddlers:
        toddler.user_id = user.id
        toddler.session_id = None
    return len(anonymous_toddlers)


# Initialize database and food data
with app.app_context():
    db.create_all()
    # Lightweight schema patches for existing SQLite DBs (create_all won't ALTER)
    try:
        from sqlalchemy import text, inspect
        insp = inspect(db.engine)
        if 'meal_logs' in insp.get_table_names():
            cols = {c['name'] for c in insp.get_columns('meal_logs')}
            if 'photo_path' not in cols:
                db.session.execute(text('ALTER TABLE meal_logs ADD COLUMN photo_path VARCHAR(500)'))
                db.session.commit()
        if 'foods' in insp.get_table_names():
            food_cols = {c['name'] for c in insp.get_columns('foods')}
            patches = [
                ('is_user_added', 'BOOLEAN DEFAULT 0'),
                ('nutrition_pending', 'BOOLEAN DEFAULT 0'),
                ('nutrition_source', 'VARCHAR(50)'),
                ('nutrition_enriched_at', 'DATETIME'),
                ('nutrition_match_name', 'VARCHAR(200)'),
                ('omega3_mg', 'FLOAT DEFAULT 0'),
            ]
            for col_name, col_type in patches:
                if col_name not in food_cols:
                    db.session.execute(text(f'ALTER TABLE foods ADD COLUMN {col_name} {col_type}'))
            db.session.commit()
        if 'food_preferences' in insp.get_table_names():
            pref_cols = {c['name'] for c in insp.get_columns('food_preferences')}
            if 'last_reaction' not in pref_cols:
                db.session.execute(text('ALTER TABLE food_preferences ADD COLUMN last_reaction VARCHAR(50)'))
                db.session.commit()
    except Exception as e:
        app.logger.warning('Schema patch skipped: %s', e)
    init_food_database(db.session, Food)


# Context processors for templates
def _env_flag(name, default=False):
    raw = (os.environ.get(name) or '').strip().lower()
    if not raw:
        return default
    return raw in ('1', 'true', 'yes', 'on')


def is_chat_feature_enabled():
    """Master switch — off by default. Set FEATURE_CHAT_ENABLED=true to allow premium chat."""
    return _env_flag('FEATURE_CHAT_ENABLED', default=False)


def get_admin_emails():
    """Comma-separated allowlist from ADMIN_EMAILS env (case-insensitive)."""
    raw = os.environ.get('ADMIN_EMAILS') or ''
    return {e.strip().lower() for e in raw.split(',') if e.strip()}


def get_admin_password():
    """Shared admin password from ADMIN_PASSWORD env."""
    return (os.environ.get('ADMIN_PASSWORD') or '').strip()


def admin_configured():
    """Admin login is available only when both email allowlist and password are set."""
    return bool(get_admin_emails() and get_admin_password())


def is_admin_session():
    """True when this browser session passed /admin env login."""
    if not admin_configured():
        return False
    if not session.get('admin_authenticated'):
        return False
    email = (session.get('admin_email') or '').strip().lower()
    return bool(email) and email in get_admin_emails()


def _admin_password_matches(provided):
    expected = get_admin_password()
    if not expected or provided is None:
        return False
    try:
        return secrets.compare_digest(
            str(provided).encode('utf-8'),
            expected.encode('utf-8'),
        )
    except Exception:
        return False


def clear_admin_session():
    session.pop('admin_authenticated', None)
    session.pop('admin_email', None)


def admin_required(f):
    """Require a successful /admin env login. Others get an indistinguishable 404."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not is_admin_session():
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Resource not found'}), 404
            return render_template('404.html'), 404
        return f(*args, **kwargs)
    return wrapped


def can_use_chat_assistant():
    """Chat UI/API: feature flag on AND logged-in premium subscriber."""
    if not is_chat_feature_enabled():
        return False
    try:
        return bool(
            current_user
            and current_user.is_authenticated
            and current_user.is_premium()
        )
    except Exception:
        return False


def _chat_access_denied_response():
    if not is_chat_feature_enabled():
        return jsonify({
            'error': 'Chat assistant is not available yet.',
            'code': 'CHAT_FEATURE_DISABLED',
            'premium': True,
        }), 403
    if not current_user.is_authenticated:
        return jsonify({
            'error': 'Sign in required for chat.',
            'code': 'AUTH_REQUIRED',
            'premium': True,
        }), 401
    if not current_user.is_premium():
        return jsonify({
            'error': 'Chat assistant is a Premium feature. Coming soon for subscribers.',
            'code': 'PREMIUM_REQUIRED',
            'premium': True,
        }), 403
    return jsonify({'error': 'Chat unavailable.', 'code': 'CHAT_DENIED'}), 403


@app.context_processor
def inject_globals():
    """Inject global variables into all templates"""
    return {
        'now': datetime.now,
        'today': date.today().isoformat(),
        'current_user': current_user,
        'is_authenticated': current_user.is_authenticated if current_user else False,
        'feature_chat_enabled': is_chat_feature_enabled(),
        'chat_assistant_available': can_use_chat_assistant(),
    }


# ==================== API / AUDIT REQUEST LOGGING ====================

_MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
_AUDIT_PATH_PREFIXES = ('/api/', '/meal-plan/', '/nutrition/', '/log-meal', '/toddlers')


@app.before_request
def _redirect_numeric_toddler_urls():
    """
    Legacy bookmarks used /dashboard/1 etc. Redirect to the opaque form so the
    address bar never keeps showing the raw profile number.
    """
    path = request.path or ''
    m = _re.match(
        r'^/('
        r'dashboard|log-meal|weekly-plan|nutrition|preferences|recipes|'
        r'api/dashboard|api/nutrition/daily|api/nutrition/breakdown|api/nutrition/weekly|'
        r'api/nutrition/alerts|api/meal-plan/weekly|api/meal-plan/daily|'
        r'api/audit-logs|api/adapt-meal|api/preferences|api/enhance|api/enhance/liked|'
        r'api/explore-flavors|api/daily-tip|api/toddlers'
        r')/(\d+)(/.*)?$',
        path,
    )
    if not m:
        return None
    prefix, raw_id, rest = m.group(1), m.group(2), m.group(3) or ''
    try:
        tid = int(raw_id)
    except ValueError:
        return None
    if Toddler.query.get(tid) is None:
        return None
    token = encode_toddler_ref(tid)
    new_path = f'/{prefix}/{token}{rest}'
    if request.query_string:
        new_path = f'{new_path}?{request.query_string.decode()}'
    return redirect(new_path, code=302)


@app.before_request
def _capture_request_for_audit():
    path = request.path or ''
    if path.startswith('/api/analytics/'):
        return
    if not any(path.startswith(p) for p in _AUDIT_PATH_PREFIXES):
        return
    g._audit_started = datetime.utcnow()
    g._audit_payload = request_payload_snapshot()


@app.after_request
def _persist_guest_cookie(response):
    """Keep a long-lived guest id cookie in sync with the anonymous session."""
    if current_user.is_authenticated:
        # Logged-in users don't need the guest cookie; clear if present.
        if request.cookies.get(GUEST_COOKIE_NAME):
            response.delete_cookie(GUEST_COOKIE_NAME, path='/')
        return response

    guest_id = getattr(g, '_refresh_guest_cookie', None) or session.get('anonymous_session_id')
    if not is_valid_guest_id(guest_id):
        return response

    secure = cookie_secure_for_request(app.config.get('SESSION_COOKIE_SECURE'), request)
    response.set_cookie(
        GUEST_COOKIE_NAME,
        guest_id,
        max_age=GUEST_COOKIE_MAX_AGE,
        httponly=True,
        samesite='Lax',
        secure=secure,
        path='/',
    )
    return response


@app.after_request
def _log_api_request(response):
    path = request.path or ''
    if path.startswith('/api/analytics/'):
        return response
    if not any(path.startswith(p) for p in _AUDIT_PATH_PREFIXES):
        return response
    if path.startswith('/api/audit-logs'):
        return response

    payload = getattr(g, '_audit_payload', None) or {}
    toddler_id = None
    try:
        if request.view_args and 'toddler_id' in request.view_args:
            toddler_id = request.view_args.get('toddler_id')
        elif isinstance(payload.get('json'), dict) and payload['json'].get('toddler_id'):
            toddler_id = payload['json'].get('toddler_id')
        elif request.args.get('toddler_id'):
            toddler_id = int(request.args.get('toddler_id'))
    except Exception:
        toddler_id = None

    body_preview = None
    try:
        if response.is_json:
            body_preview = response.get_json(silent=True)
    except Exception:
        body_preview = None

    app_log(
        f'{request.method} {path} -> {response.status_code}',
        request=payload,
        response_preview=body_preview if request.method in _MUTATING_METHODS else None,
        toddler_id=toddler_id,
    )

    # Persist DB audit rows for mutating calls (and plan regenerates via GET ?regenerate=true)
    should_db = request.method in _MUTATING_METHODS
    if path.startswith('/api/meal-plan/weekly/') and request.args.get('regenerate', '').lower() == 'true':
        should_db = True
    if should_db:
        try:
            write_audit_log(
                action=f'api.{request.method.lower()}',
                toddler_id=int(toddler_id) if toddler_id is not None else None,
                entity_type='http_request',
                entity_id=path,
                before=None,
                after={'status': response.status_code, 'body': body_preview},
                details=payload,
                source='http',
                commit=True,
            )
        except Exception as exc:
            app_log(f'audit write failed: {exc}')

    return response


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
        db.session.flush()
        
        transferred = _transfer_anonymous_toddlers(user)
        db.session.commit()
        
        # Log them in
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()

        record_analytics_event(
            db.session,
            event_type='action',
            action_name='user.signup',
            path='/signup',
            meta={'transferred_toddlers': transferred},
        )
        
        msg = 'Account created successfully! Your data has been saved.'
        if transferred:
            msg = f'Account created! {transferred} toddler profile(s) transferred to your account.'
        flash(msg, 'success')
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
            
            _transfer_anonymous_toddlers(user)
            # Always remember on sign-in so PWA reopen keeps the account session
            login_user(user, remember=True)
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
        toddlers = get_user_toddlers()
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict(),
            'toddlers': [t.to_dict() for t in toddlers],
            'guest_id': None,
        })

    guest_id = get_session_id()
    toddlers = get_user_toddlers()
    return jsonify({
        'authenticated': False,
        'guest_id': guest_id,
        'toddlers': [t.to_dict() for t in toddlers],
        'session_id': guest_id[:8] + '...',
    })


@app.route('/api/auth/restore', methods=['POST'])
def restore_guest_session():
    """
    Rehydrate an anonymous session from a client-stored guest id.

    Used when the Flask session cookie was dropped but localStorage still has
    the guest token from a previous visit (PWA / mobile cookie loss).
    """
    if current_user.is_authenticated:
        toddlers = get_user_toddlers()
        return jsonify({
            'restored': True,
            'authenticated': True,
            'guest_id': None,
            'toddlers': [t.to_dict() for t in toddlers],
        })

    data = request.get_json(silent=True) or {}
    guest_id = (data.get('guest_id') or '').strip()
    if not is_valid_guest_id(guest_id):
        # Fall back to cookie / existing session
        guest_id = get_session_id()
        toddlers = get_user_toddlers()
        return jsonify({
            'restored': bool(toddlers),
            'authenticated': False,
            'guest_id': guest_id,
            'toddlers': [t.to_dict() for t in toddlers],
        })

    adopt_guest_id(guest_id)
    toddlers = Toddler.query.filter_by(session_id=guest_id, user_id=None).all()
    return jsonify({
        'restored': True,
        'authenticated': False,
        'guest_id': guest_id,
        'toddlers': [t.to_dict() for t in toddlers],
    })


# ==================== WEB ROUTES ====================

@app.route('/')
def index():
    """Landing page - marketing page for new visitors"""
    return render_template('landing.html')


@app.route('/apple-touch-icon.png')
@app.route('/apple-touch-icon-precomposed.png')
def apple_touch_icon():
    """iOS Safari requests this at the site root for Add to Home Screen icons."""
    from flask import send_from_directory
    icons_dir = os.path.join(app.root_path, 'static', 'icons')
    response = send_from_directory(
        icons_dir,
        'apple-touch-icon.png',
        mimetype='image/png',
    )
    response.cache_control.max_age = 86400
    response.cache_control.public = True
    return response


@app.route('/home')
def home():
    """
    App entry (PWA start_url).

    If we already know toddlers for this browser session/cookie, go straight to
    the dashboard. Otherwise render a tiny bridge page that restores guest id
    from localStorage before deciding onboarding vs dashboard — this fixes the
    common mobile bug where completed onboarding "resets" after reopen.
    """
    toddlers = get_user_toddlers()
    if toddlers:
        return redirect(url_for('dashboard', toddler_id=toddlers[0].id))
    return render_template('home_bridge.html')


@app.route('/onboarding')
def onboarding():
    """Onboarding page to add a toddler"""
    # If this browser already has a profile (cookie restored), skip the form.
    toddlers = get_user_toddlers()
    if toddlers:
        return redirect(url_for('dashboard', toddler_id=toddlers[0].id))
    return render_template('onboarding.html', allergens=COMMON_ALLERGENS)


@app.route('/dashboard/<toddler_ref:toddler_id>')
def dashboard(toddler_id):
    """Main dashboard for a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('dashboard.html', toddler=toddler, toddlers=toddlers)


def _meal_log_components(meal):
    """Build {food_id, name, role} list for multi-item meal logging UI."""
    components = []
    if not meal:
        return components
    if meal.get('is_complete_meal'):
        for role in ('main', 'carb', 'side'):
            comp = meal.get(role) or {}
            fid = comp.get('food_id')
            if not fid and isinstance(comp.get('food'), dict):
                fid = comp['food'].get('id')
            name = comp.get('food_name') or (comp.get('food') or {}).get('name')
            if fid and name:
                components.append({'food_id': fid, 'name': name, 'role': role})
    elif meal.get('food'):
        f = meal['food']
        components.append({'food_id': f['id'], 'name': f['name'], 'role': 'main'})
    return components


@app.route('/log-meal/<toddler_ref:toddler_id>')
def log_meal_page(toddler_id):
    """Page to log a meal — defaults to today's recommended plan"""

    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    foods = Food.query.filter(Food.suitable_from_months <= toddler.age_months).order_by(Food.name).all()
    foods_data = [f.to_dict() for f in foods]
    toddlers = get_user_toddlers()
    
    # Ensure week's plan exists and load today's recommendations
    planner = MealPlanner(db.session)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    weekly = planner.generate_weekly_plan(toddler, week_start, regenerate=False)
    today_plan = next((d for d in weekly.get('days', []) if d.get('date') == today.isoformat()), None)
    
    # Existing logs for today (mark meals already logged)
    today_logs = MealLog.query.filter_by(toddler_id=toddler.id, date=today).all()
    logged_by_meal = {}
    for log in today_logs:
        logged_by_meal.setdefault(log.meal_type, []).append(log.to_dict())
    
    if today_plan and today_plan.get('meals'):
        for _mt, _meal in today_plan['meals'].items():
            _meal['log_components'] = _meal_log_components(_meal)
    
    return render_template(
        'log_meal.html',
        toddler=toddler,
        toddlers=toddlers,
        foods=foods,
        foods_data=foods_data,
        today_plan=today_plan,
        logged_by_meal=logged_by_meal,
        meal_order=['breakfast', 'mid_morning_snack', 'lunch', 'evening_snack', 'dinner'],
        meal_labels={
            'breakfast': '🌅 Breakfast',
            'mid_morning_snack': '🍎 Mid-Morning Snack',
            'lunch': '🍱 Lunch',
            'evening_snack': '🥛 Evening Snack',
            'dinner': '🌙 Dinner',
        }
    )


@app.route('/weekly-plan/<toddler_ref:toddler_id>')
def weekly_plan_page(toddler_id):
    """Weekly meal plan page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('weekly_plan.html', toddler=toddler, toddlers=toddlers)


@app.route('/nutrition/<toddler_ref:toddler_id>')
def nutrition_page(toddler_id):
    """Nutrition analysis page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    engine = NutritionEngine(db.session)
    rda = engine.get_rda(toddler.age_months)

    milk_names = ['Breast Milk', 'Infant Formula', 'Milk (Whole)']
    milk_foods = {
        f.name: f
        for f in Food.query.filter(Food.name.in_(milk_names)).all()
    }
    milk_options = []
    for name in milk_names:
        food = milk_foods.get(name)
        if not food:
            continue
        # Cow milk is for 12+ months; still show but flag
        milk_options.append({
            'id': food.id,
            'name': food.name,
            'name_hindi': food.name_hindi,
            'suitable_from_months': food.suitable_from_months or 0,
            'serving_ml': food.get_serving_for_age(toddler.age_months) or 100,
            'omega3_mg_per_100': food.omega3_mg or 0,
            'disabled': toddler.age_months < (food.suitable_from_months or 0),
        })

    return render_template(
        'nutrition.html',
        toddler=toddler,
        toddlers=toddlers,
        rda=rda,
        milk_options=milk_options,
    )


@app.route('/preferences/<toddler_ref:toddler_id>')
def preferences_page(toddler_id):
    """Food preferences page"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    return render_template('preferences.html', toddler=toddler, toddlers=toddlers)


@app.route('/recipes/<toddler_ref:toddler_id>')
def recipes_page(toddler_id):
    """Recipe ideas — curated + one card per food in the database"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        flash('You do not have access to this profile.', 'error')
        return redirect(url_for('home'))
    toddlers = get_user_toddlers()
    q = request.args.get('q', '').strip() or None
    category = request.args.get('category', '').strip() or None
    highlight = request.args.get('highlight', '').strip() or None
    recipes = list_recipes(category=category, q=q)
    # Put highlighted recipe first when present
    if highlight:
        recipes = sorted(recipes, key=lambda r: 0 if r.get('slug') == highlight else 1)
    categories = sorted({r.get('category') for r in list_recipes() if r.get('category')})
    return render_template(
        'recipes.html',
        toddler=toddler,
        toddlers=toddlers,
        recipes=recipes,
        categories=categories,
        q=q or '',
        category=category or '',
        highlight=highlight or '',
    )


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
        session.permanent = True
        toddler.session_id = get_session_id()
    
    if toddler.weight_kg:
        toddler.weight_updated_at = date.today()
    
    db.session.add(toddler)
    db.session.commit()

    record_analytics_event(
        db.session,
        event_type='action',
        action_name='toddler.created',
        path='/onboarding',
        toddler_id=toddler.id,
        meta={'age_months': toddler.age_months},
    )
    
    payload = toddler.to_dict()
    if not current_user.is_authenticated:
        payload['guest_id'] = get_session_id()
    return jsonify(payload), 201


@app.route('/api/toddlers/<toddler_ref:toddler_id>', methods=['GET'])
def get_toddler(toddler_id):
    """Get a specific toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    return jsonify(toddler.to_dict())


@app.route('/api/toddlers/<toddler_ref:toddler_id>', methods=['PUT'])
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


@app.route('/api/toddlers/<toddler_ref:toddler_id>/health', methods=['PUT'])
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


@app.route('/api/toddlers/<toddler_ref:toddler_id>', methods=['DELETE'])
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


@app.route('/api/foods', methods=['POST'])
def create_food():
    """
    Add a custom food when it's missing from the database.
    Nutrients start at 0 / pending; enrichment runs in the background.
    """
    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Food name is required'}), 400
    if len(name) > 200:
        return jsonify({'error': 'Food name is too long'}), 400

    # Prefer existing match (case-insensitive exact)
    existing = Food.query.filter(db.func.lower(Food.name) == name.lower()).first()
    if existing:
        return jsonify({
            **existing.to_dict(),
            'already_existed': True,
            'message': f'"{existing.name}" is already in the database'
        }), 200

    category = data.get('category')
    if category:
        category = str(category).lower().strip()
    if not category or category not in FOOD_CATEGORIES:
        category = guess_category(name)

    food = Food(
        name=name,
        name_hindi=data.get('name_hindi'),
        category=category,
        spice_level=int(data.get('spice_level', 0) or 0),
        texture=data.get('texture') or 'soft',
        allergens=data.get('allergens') or [],
        suitable_from_months=int(data.get('suitable_from_months', 12) or 12),
        toddler_friendly_version=data.get('toddler_friendly_version') or f'User-added: serve age-appropriate soft portions of {name}',
        preparation_tips=data.get('preparation_tips'),
        is_user_added=True,
        nutrition_pending=True,
        nutrition_source=None,
    )
    db.session.add(food)
    db.session.commit()

    enrich_async = data.get('enrich', True)
    if enrich_async:
        _enqueue_food_enrichment(food.id)

    result = food.to_dict()
    result['already_existed'] = False
    result['enrichment_started'] = bool(enrich_async)
    result['message'] = (
        f'Added "{food.name}". Looking up nutrients in the background…'
        if enrich_async else
        f'Added "{food.name}".'
    )
    return jsonify(result), 201


@app.route('/api/foods/<int:food_id>/enrich', methods=['POST'])
def enrich_food(food_id):
    """Re-run nutrient enrichment for a food (sync)."""
    food = Food.query.get_or_404(food_id)
    result = _enrich_food_record(food.id)
    if not result:
        return jsonify({'error': 'Enrichment failed'}), 500
    return jsonify(result)


def _enqueue_food_enrichment(food_id):
    """Run nutrient lookup in a daemon thread with app context."""
    import threading

    def _worker():
        with app.app_context():
            try:
                _enrich_food_record(food_id)
            except Exception as exc:
                app.logger.warning('Background enrichment failed for food %s: %s', food_id, exc)

    thread = threading.Thread(target=_worker, daemon=True, name=f'enrich-food-{food_id}')
    thread.start()


def _enrich_food_record(food_id):
    """Lookup nutrients and update Food row. Returns food dict or None."""
    food = Food.query.get(food_id)
    if not food:
        return None

    nutrients = lookup_nutrients(food.name, food.category)
    food.calories = nutrients.get('calories', 0) or 0
    food.protein_g = nutrients.get('protein_g', 0) or 0
    food.carbs_g = nutrients.get('carbs_g', 0) or 0
    food.fat_g = nutrients.get('fat_g', 0) or 0
    food.fiber_g = nutrients.get('fiber_g', 0) or 0
    food.calcium_mg = nutrients.get('calcium_mg', 0) or 0
    food.iron_mg = nutrients.get('iron_mg', 0) or 0
    food.zinc_mg = nutrients.get('zinc_mg', 0) or 0
    food.vitamin_a_mcg = nutrients.get('vitamin_a_mcg', 0) or 0
    food.vitamin_c_mg = nutrients.get('vitamin_c_mg', 0) or 0
    food.vitamin_d_mcg = nutrients.get('vitamin_d_mcg', 0) or 0
    food.vitamin_b12_mcg = nutrients.get('vitamin_b12_mcg', 0) or 0
    food.folate_mcg = nutrients.get('folate_mcg', 0) or 0
    food.omega3_mg = nutrients.get('omega3_mg', 0) or 0
    food.nutrition_source = nutrients.get('source')
    food.nutrition_match_name = nutrients.get('matched_name')
    food.nutrition_pending = False
    food.nutrition_enriched_at = datetime.utcnow()
    if nutrients.get('category_used') and food.is_user_added and not food.category:
        food.category = nutrients['category_used']
    db.session.commit()
    return food.to_dict()


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

def _normalize_portion_for_reaction(portion_eaten_percent, toddler_reaction):
    """
    Align stored portion with reaction for accurate nutrition stats.
    Refused foods are stored as 0% eaten.
    """
    reaction = (toddler_reaction or '').lower().strip()
    if reaction == 'refused':
        return 0
    if portion_eaten_percent is None:
        return 100
    try:
        return max(0, min(100, int(portion_eaten_percent)))
    except (TypeError, ValueError):
        return 100


@app.route('/api/meal-logs', methods=['GET'])
def get_meal_logs():
    """Get meal logs with optional filtering"""
    toddler_id = resolve_toddler_id(request.args.get('toddler_id'))
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
    """
    Log a meal (single food or multiple items).
    
    Single: food_id, portion_eaten_percent, toddler_reaction
    Multi: items = [{food_id, portion_eaten_percent, toddler_reaction, notes?}, ...]
    
    Optional:
    - update_plan: if True and food differs from plan, update today's weekly plan
    - plan_id: weekly plan entry id to update
    - replace_plan: same as update_plan (alias)
    """
    data = request.json
    
    tid = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))
    if not tid or not data.get('meal_type'):
        return jsonify({'error': 'Toddler ID and meal type are required'}), 400
    
    toddler = Toddler.query.get_or_404(tid)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    
    log_date = datetime.strptime(data.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    meal_type = data['meal_type']
    items = data.get('items') or []
    
    # Backwards-compatible single-item payload
    if not items and data.get('food_id'):
        items = [{
            'food_id': data.get('food_id'),
            'custom_food_name': data.get('custom_food_name'),
            'portion_eaten_percent': data.get('portion_eaten_percent', 100),
            'toddler_reaction': data.get('toddler_reaction'),
            'notes': data.get('notes'),
        }]
    
    if not items:
        return jsonify({'error': 'At least one food item is required'}), 400
    
    created_logs = []
    shared_notes = data.get('notes') or ''
    photo_saved = None
    
    # When re-logging the same meal slot, clear previous entries for that day
    if data.get('replace_existing'):
        existing = MealLog.query.filter_by(
            toddler_id=toddler.id,
            date=log_date,
            meal_type=meal_type,
        ).all()
        for old in existing:
            db.session.delete(old)
        db.session.flush()
    
    for idx, item in enumerate(items):
        if not item.get('food_id') and not item.get('custom_food_name'):
            continue
        reaction = item.get('toddler_reaction')
        if not reaction:
            return jsonify({'error': f'Reaction required for {item.get("name") or "each food"}'}), 400
        
        portion = _normalize_portion_for_reaction(
            item.get('portion_eaten_percent', 100),
            reaction,
        )
        
        log = MealLog(
            toddler_id=toddler.id,
            food_id=item.get('food_id'),
            date=log_date,
            meal_type=meal_type,
            custom_food_name=item.get('custom_food_name'),
            portion_offered_g=item.get('portion_offered_g'),
            portion_eaten_percent=portion,
            is_adult_meal_adapted=data.get('is_adult_meal_adapted', False),
            adult_meal_description=data.get('adult_meal_description'),
            toddler_reaction=reaction,
            notes=item.get('notes') or shared_notes,
            photo_path=data.get('photo_path') if idx == 0 else None,
        )
        
        if idx == 0 and data.get('photo_data') and not log.photo_path:
            saved = _save_meal_photo(toddler.id, data['photo_data'])
            if saved:
                log.photo_path = saved
                photo_saved = saved
        
        db.session.add(log)
        created_logs.append(log)
    
    if not created_logs:
        return jsonify({'error': 'No valid food items to log'}), 400
    
    plan_updated = None
    should_update_plan = data.get('update_plan') or data.get('replace_plan')
    primary_food_id = data.get('plan_food_id') or created_logs[0].food_id
    
    if should_update_plan and primary_food_id:
        plan_updated = _update_today_plan_with_food(
            toddler,
            meal_type,
            primary_food_id,
            log_date,
            reason=data.get('plan_reason') or 'Logged different meal than planned'
        )
    
    db.session.commit()
    
    for log in created_logs:
        if log.toddler_reaction and log.food_id:
            update_preferences_from_log(db.session, log)

    record_analytics_event(
        db.session,
        event_type='action',
        action_name='meal.logged',
        path=f'/log-meal/{encode_toddler_ref(toddler.id)}',
        toddler_id=toddler.id,
        meta={
            'meal_type': meal_type,
            'item_count': len(created_logs),
            'date': log_date.isoformat(),
        },
    )
    
    if len(created_logs) == 1:
        result = created_logs[0].to_dict()
        if plan_updated is not None:
            result['plan_updated'] = plan_updated
        return jsonify(result), 201
    
    return jsonify({
        'created_logs': [l.to_dict() for l in created_logs],
        'count': len(created_logs),
        'photo_path': photo_saved,
        'plan_updated': plan_updated,
        'message': f'Logged {len(created_logs)} items for {meal_type}',
    }), 201


def _update_today_plan_with_food(toddler, meal_type, food_id, log_date, reason=''):
    """Update today's weekly plan entry to a different food and adjust near-future repeats."""
    week_start = log_date - timedelta(days=log_date.weekday())
    day_of_week = log_date.weekday()
    
    existing_plan = WeeklyPlan.query.filter(
        WeeklyPlan.toddler_id == toddler.id,
        WeeklyPlan.week_start == week_start,
        WeeklyPlan.day_of_week == day_of_week,
        WeeklyPlan.meal_type == meal_type
    ).first()
    
    food = Food.query.get(food_id)
    food_name = food.name if food else str(food_id)
    
    if existing_plan:
        old_food_id = existing_plan.food_id
        existing_plan.food_id = food_id
        existing_plan.is_generated = False
        existing_plan.nutrition_reason = reason or f"Replaced with logged meal: {food_name}"
        # Clear structured complete-meal alternatives when manually replaced
        existing_plan.alternatives = {'backup': None, 'replaced': True, 'from_log': True}
        plan_id = existing_plan.id
    else:
        new_plan = WeeklyPlan(
            toddler_id=toddler.id,
            week_start=week_start,
            day_of_week=day_of_week,
            meal_type=meal_type,
            food_id=food_id,
            is_generated=False,
            nutrition_reason=reason or f"Added from meal log: {food_name}",
            alternatives={'from_log': True}
        )
        db.session.add(new_plan)
        db.session.flush()
        plan_id = new_plan.id
        old_food_id = None
    
    # Avoid immediate repetition in next 2 days
    future_plans = WeeklyPlan.query.filter(
        WeeklyPlan.toddler_id == toddler.id,
        WeeklyPlan.week_start == week_start,
        WeeklyPlan.day_of_week > day_of_week,
        WeeklyPlan.day_of_week <= day_of_week + 2,
        WeeklyPlan.food_id == food_id
    ).all()
    
    swaps = 0
    if future_plans:
        planner = MealPlanner(db.session)
        suitable = planner._get_suitable_foods(toddler)
        for plan in future_plans:
            current = Food.query.get(plan.food_id)
            alts = [
                f for f in suitable
                if f.id != food_id and f.id != (current.id if current else None)
                and (not current or f.category == current.category)
            ]
            if alts:
                import random
                swap = random.choice(alts)
                plan.food_id = swap.id
                plan.nutrition_reason = f"Swapped to avoid repetition of {food_name}"
                swaps += 1
    
    return {
        'plan_id': plan_id,
        'food_id': food_id,
        'food_name': food_name,
        'replaced_previous': old_food_id is not None and old_food_id != food_id,
        'future_plans_adjusted': swaps
    }


def _save_meal_photo(toddler_id, photo_data):
    """Save a base64 data-URL meal photo under static/uploads/meals/"""
    match = _re.match(r'^data:image/(png|jpeg|jpg|webp);base64,(.+)$', photo_data, _re.I | _re.S)
    if not match:
        return None
    
    ext = match.group(1).lower().replace('jpeg', 'jpg')
    raw = base64.b64decode(match.group(2))
    # Cap ~4MB
    if len(raw) > 4 * 1024 * 1024:
        return None
    
    upload_dir = Path(app.root_path) / 'static' / 'uploads' / 'meals'
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"t{toddler_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}.{ext}"
    path = upload_dir / filename
    path.write_bytes(raw)
    return f"/static/uploads/meals/{filename}"


def _save_recipe_cover(photo_data):
    """Persist recipe cover under instance/uploads/recipes (Docker volume)."""
    match = _re.match(r'^data:image/(png|jpeg|jpg|webp);base64,(.+)$', photo_data, _re.I | _re.S)
    if not match:
        return None
    ext = match.group(1).lower().replace('jpeg', 'jpg')
    raw = base64.b64decode(match.group(2))
    if len(raw) > 4 * 1024 * 1024:
        return None
    upload_dir = Path(_INSTANCE_DIR) / 'uploads' / 'recipes'
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"recipe_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}.{ext}"
    (upload_dir / filename).write_bytes(raw)
    return f"/media/recipes/{filename}"


@app.route('/media/recipes/<path:filename>')
def serve_recipe_media(filename):
    """Serve admin-uploaded recipe covers from the persistent instance volume."""
    from flask import send_from_directory
    safe = Path(filename).name
    directory = Path(_INSTANCE_DIR) / 'uploads' / 'recipes'
    if not (directory / safe).is_file():
        return render_template('404.html'), 404
    return send_from_directory(directory, safe)


@app.route('/api/meal-logs/<int:log_id>', methods=['PUT'])
def update_meal_log(log_id):
    """Update a meal log (portion, reaction, notes, food)."""
    log = MealLog.query.get_or_404(log_id)
    toddler = Toddler.query.get_or_404(log.toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403

    data = request.json or {}

    if 'food_id' in data:
        log.food_id = data['food_id']
    if 'custom_food_name' in data:
        log.custom_food_name = data['custom_food_name']
    if 'toddler_reaction' in data:
        if not data['toddler_reaction']:
            return jsonify({'error': 'Reaction is required'}), 400
        log.toddler_reaction = data['toddler_reaction']
    if 'portion_eaten_percent' in data or 'toddler_reaction' in data:
        portion_src = data.get('portion_eaten_percent', log.portion_eaten_percent)
        log.portion_eaten_percent = _normalize_portion_for_reaction(
            portion_src,
            log.toddler_reaction,
        )
    if 'notes' in data:
        log.notes = data['notes']

    db.session.commit()

    if log.toddler_reaction and log.food_id:
        update_preferences_from_log(db.session, log)

    return jsonify(log.to_dict())


@app.route('/api/meal-logs/<int:log_id>', methods=['DELETE'])
def delete_meal_log(log_id):
    """Delete a meal log"""
    log = MealLog.query.get_or_404(log_id)
    toddler = Toddler.query.get_or_404(log.toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Meal log deleted successfully'})


@app.route('/api/meal-logs/batch', methods=['PUT'])
def update_meal_logs_batch():
    """
    Update multiple meal log items in one request.
    Body: { items: [{id, portion_eaten_percent?, toddler_reaction?, notes?, food_id?}, ...] }
    """
    data = request.json or {}
    items = data.get('items') or []
    if not items:
        return jsonify({'error': 'No items to update'}), 400

    updated = []
    for item in items:
        log_id = item.get('id')
        if not log_id:
            continue
        log = MealLog.query.get(log_id)
        if not log:
            return jsonify({'error': f'Meal log {log_id} not found'}), 404
        toddler = Toddler.query.get(log.toddler_id)
        if not toddler or not owns_toddler(toddler):
            return jsonify({'error': 'Not authorized'}), 403

        if 'food_id' in item:
            log.food_id = item['food_id']
        if 'toddler_reaction' in item:
            if not item['toddler_reaction']:
                return jsonify({'error': f'Reaction required for log {log_id}'}), 400
            log.toddler_reaction = item['toddler_reaction']
        if 'portion_eaten_percent' in item or 'toddler_reaction' in item:
            portion_src = item.get('portion_eaten_percent', log.portion_eaten_percent)
            log.portion_eaten_percent = _normalize_portion_for_reaction(
                portion_src,
                log.toddler_reaction,
            )
        if 'notes' in item:
            log.notes = item['notes']
        updated.append(log)

    if not updated:
        return jsonify({'error': 'No valid items to update'}), 400

    db.session.commit()

    for log in updated:
        if log.toddler_reaction and log.food_id:
            update_preferences_from_log(db.session, log)

    return jsonify({
        'updated_logs': [l.to_dict() for l in updated],
        'count': len(updated),
        'message': f'Updated {len(updated)} meal log(s)',
    })


# --- Nutrition Analysis ---

@app.route('/api/nutrition/daily/<toddler_ref:toddler_id>', methods=['GET'])
def get_daily_nutrition(toddler_id):
    """Get daily nutrition status"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
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


@app.route('/api/nutrition/breakdown/<toddler_ref:toddler_id>', methods=['GET'])
def get_nutrition_breakdown(toddler_id):
    """Per-item / per-meal nutrient calculation breakdown for a day."""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    date_str = request.args.get('date', date.today().isoformat())
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()

    engine = NutritionEngine(db.session)
    breakdown = engine.get_daily_breakdown(toddler, target_date)
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        'age_months': toddler.age_months,
        **breakdown,
    })


@app.route('/api/nutrition/weekly/<toddler_ref:toddler_id>', methods=['GET'])
def get_weekly_nutrition(toddler_id):
    """Get weekly nutrition analysis"""
    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403
    
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


@app.route('/api/nutrition/alerts/<toddler_ref:toddler_id>', methods=['GET'])
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

@app.route('/api/meal-plan/weekly/<toddler_ref:toddler_id>', methods=['GET'])
def get_weekly_plan(toddler_id):
    """Get or generate weekly meal plan"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    week_start_str = request.args.get('week_start')
    if week_start_str:
        week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
        # Normalize to Monday of that week
        week_start = week_start - timedelta(days=week_start.weekday())
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


@app.route('/api/audit-logs/<toddler_ref:toddler_id>', methods=['GET'])
def get_audit_logs(toddler_id):
    """List recent audit log entries for a toddler (plan changes + API mutations)."""
    Toddler.query.get_or_404(toddler_id)
    limit = min(int(request.args.get('limit', 100)), 500)
    action = request.args.get('action')
    q = AuditLog.query.filter_by(toddler_id=toddler_id).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action == action)
    rows = q.limit(limit).all()
    return jsonify({
        'toddler_id': toddler_id,
        'count': len(rows),
        'logs': [r.to_dict() for r in rows],
    })


@app.route('/api/meal-plan/daily/<toddler_ref:toddler_id>', methods=['GET'])
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

@app.route('/api/adapt-meal/<toddler_ref:toddler_id>', methods=['POST'])
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

@app.route('/api/preferences/<toddler_ref:toddler_id>', methods=['GET'])
def get_preferences(toddler_id):
    """Get food preferences for a toddler"""
    toddler = Toddler.query.get_or_404(toddler_id)
    
    preferences = FoodPreference.query.filter_by(toddler_id=toddler_id).all()

    # Backfill last_reaction from newest meal log when missing (legacy rows)
    missing = [p for p in preferences if not p.last_reaction and p.food_id]
    if missing:
        for pref in missing:
            latest = (
                MealLog.query.filter_by(toddler_id=toddler_id, food_id=pref.food_id)
                .filter(MealLog.toddler_reaction.isnot(None))
                .order_by(MealLog.date.desc(), MealLog.id.desc())
                .first()
            )
            if latest and latest.toddler_reaction:
                pref.last_reaction = latest.toddler_reaction.lower().strip()
                # Align score if old EMA left "loved" stuck under the liked threshold
                if pref.last_reaction in FoodPreference.REACTION_SCORES:
                    target = FoodPreference.REACTION_SCORES[pref.last_reaction]
                    if pref.last_reaction in ('loved', 'liked') and (pref.preference_score or 0) < 0.5:
                        pref.preference_score = target
                    elif pref.last_reaction == 'neutral':
                        pref.preference_score = 0.0
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
    
    # Categorize by last reaction (falls back to score) so UI matches meal logging
    liked, neutral, disliked = [], [], []
    for p in preferences:
        bucket = p.display_bucket()
        row = p.to_dict()
        if bucket == 'liked':
            liked.append(row)
        elif bucket == 'disliked':
            disliked.append(row)
        else:
            neutral.append(row)
    
    return jsonify({
        'toddler_id': toddler_id,
        'toddler_name': toddler.name,
        'liked': sorted(liked, key=lambda x: x['preference_score'], reverse=True),
        'neutral': neutral,
        'disliked': sorted(disliked, key=lambda x: x['preference_score']),
        'total': len(preferences)
    })


@app.route('/api/preferences/<toddler_ref:toddler_id>/<int:food_id>', methods=['PUT'])
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

@app.route('/api/enhance/<toddler_ref:toddler_id>', methods=['GET'])
def get_food_enhancements(toddler_id):
    """Get enhancement suggestions for a specific food"""
    toddler = Toddler.query.get_or_404(toddler_id)
    food_name = request.args.get('food')
    
    if not food_name:
        return jsonify({'error': 'Food name is required'}), 400
    
    suggestions = get_enhancement_suggestions(food_name, toddler)
    return jsonify(suggestions)


@app.route('/api/enhance/liked/<toddler_ref:toddler_id>', methods=['GET'])
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


@app.route('/api/explore-flavors/<toddler_ref:toddler_id>', methods=['GET'])
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


@app.route('/api/daily-tip/<toddler_ref:toddler_id>', methods=['GET'])
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
    toddler_id = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))
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
        # Per-food ate/refused: if this food was refused, force 0% intake
        if (reaction or '').lower() == 'refused':
            portion = 0
        portion = _normalize_portion_for_reaction(portion, reaction)
        
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
    Help identify food from a meal photo + optional caption.

    Accepts:
    - image / photo_data: base64 data-URL (validated; not stored until meal is logged)
    - caption / text: optional description (uses NLP food matching)
    - predictions: optional client-side ML class labels
    - meal_type, toddler_id: used to rank age-suitable suggestions

    Returns ranked suggestion list for the user to confirm before logging.
    The photo is persisted later via POST /api/meal-logs with photo_data.
    """
    data = request.json or {}
    image_data = data.get('image') or data.get('photo_data')
    caption = (data.get('caption') or data.get('text') or '').strip()
    predictions = data.get('predictions') or []
    meal_type = data.get('meal_type')
    toddler_id = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))

    toddler = Toddler.query.get(toddler_id) if toddler_id else None
    age_months = toddler.age_months if toddler else 24

    foods = Food.query.filter(Food.suitable_from_months <= age_months).all()
    food_list = [{'name': f.name, 'id': f.id} for f in foods]

    suggestions = []
    seen_ids = set()
    sources = []
    parsed = None

    def _add_suggestion(food, confidence, source, label=None):
        if not food or food.id in seen_ids:
            return
        seen_ids.add(food.id)
        suggestions.append({
            'food_id': food.id,
            'name': food.name,
            'name_hindi': food.name_hindi,
            'category': food.category,
            'toddler_friendly_version': food.toddler_friendly_version,
            'confidence': round(float(confidence), 3),
            'source': source,
            'label': label or food.name
        })

    # 1) Caption / natural language (most reliable without an on-device model)
    if caption:
        sources.append('caption')
        parsed = parse_meal_input(caption, food_list)
        for food_info in parsed.get('foods', []):
            db_food = None
            fid = food_info.get('id') or food_info.get('food_id')
            if fid:
                db_food = Food.query.get(fid)
            if not db_food:
                db_food = Food.query.filter(Food.name.ilike(f"%{food_info['name']}%")).first()
            if db_food:
                _add_suggestion(db_food, food_info.get('confidence', 0.85), 'caption', food_info['name'])

    # 2) Client-side model predictions (if TensorFlow.js etc. is wired up)
    if predictions:
        sources.append('predictions')
        for pred in predictions:
            label = pred.get('class') or pred.get('label') or ''
            if not label:
                continue
            conf = pred.get('confidence', 0.5)
            db_food = Food.query.filter(Food.name.ilike(f"%{label}%")).first()
            if db_food:
                _add_suggestion(db_food, conf, 'ml', label)

    # 3) Meal-type ranked fallbacks so the user can always pick something
    if meal_type:
        sources.append('meal_suggestions')
        category_prefs = {
            'breakfast': ['breakfast', 'grain', 'dairy', 'fruit'],
            'mid_morning_snack': ['fruit', 'dairy', 'snack'],
            'lunch': ['dal', 'curry', 'vegetable', 'grain', 'complete'],
            'evening_snack': ['fruit', 'dairy', 'snack'],
            'dinner': ['dal', 'curry', 'vegetable', 'grain', 'complete'],
        }
        preferred = category_prefs.get(meal_type, [])
        ranked = sorted(
            foods,
            key=lambda f: (
                0 if (f.category or '').lower() in preferred else 1,
                f.name
            )
        )
        for food in ranked[:12]:
            _add_suggestion(food, 0.35, 'suggestion')

    photo_ok = False
    if image_data:
        # Validate without saving — meal log POST will persist it
        if isinstance(image_data, str) and image_data.startswith('data:image/'):
            photo_ok = True
            sources.append('photo')

    if not suggestions and not photo_ok and not caption:
        return jsonify({
            'status': 'need_input',
            'message': 'Add a photo and/or a short description of what was on the plate.',
            'suggestions': []
        }), 400

    suggestions.sort(key=lambda s: s['confidence'], reverse=True)

    return jsonify({
        'status': 'ok',
        'photo_ready': photo_ok,
        'sources': sources,
        'parsed': parsed,
        'suggestions': suggestions[:20],
        'detected_foods': suggestions[:10],  # backwards-compatible alias
        'message': (
            'Confirm the food below. Your photo will be saved with the meal log.'
            if photo_ok else
            'Confirm the food that matches what was eaten.'
        )
    })


# --- Dashboard Data ---

def _logging_stats_for_toddler(toddler_id, today=None):
    """
    Lifetime logging analytics for the dashboard.
    - total_meals: distinct meal occasions (date + meal_type)
    - days_logged: distinct calendar days with ≥1 log
    - current_streak: consecutive days ending today (or yesterday if today empty)
    """
    today = today or date.today()
    rows = (
        db.session.query(MealLog.date, MealLog.meal_type)
        .filter(MealLog.toddler_id == toddler_id)
        .distinct()
        .all()
    )
    if not rows:
        return {
            'total_meals_logged': 0,
            'days_logged': 0,
            'current_streak': 0,
            'longest_streak': 0,
            'last_logged_date': None,
        }

    meal_keys = {(r.date, r.meal_type) for r in rows}
    days = sorted({r.date for r in rows})
    day_set = set(days)

    # Current streak: walk backward from today if logged, else from yesterday
    if today in day_set:
        cursor = today
    elif (today - timedelta(days=1)) in day_set:
        cursor = today - timedelta(days=1)
    else:
        cursor = None

    current_streak = 0
    if cursor is not None:
        while cursor in day_set:
            current_streak += 1
            cursor -= timedelta(days=1)

    # Longest streak across all history
    longest = 0
    run = 0
    prev = None
    for d in days:
        if prev is not None and d == prev + timedelta(days=1):
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        prev = d

    return {
        'total_meals_logged': len(meal_keys),
        'days_logged': len(days),
        'current_streak': current_streak,
        'longest_streak': longest,
        'last_logged_date': days[-1].isoformat() if days else None,
    }


@app.route('/api/dashboard/<toddler_ref:toddler_id>', methods=['GET'])
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
    
    # Today's plan from the same weekly-plan source as Log Meal / Weekly Plan
    planner = MealPlanner(db.session)
    week_start = today - timedelta(days=today.weekday())
    weekly = planner.generate_weekly_plan(toddler, week_start, regenerate=False)
    today_plan = next(
        (d for d in weekly.get('days', []) if d.get('date') == today.isoformat()),
        None
    )
    
    # Fallback suggestions only for slots with no plan entry
    suggestions = planner.get_daily_suggestions(toddler, today)
    planned_types = set((today_plan or {}).get('meals', {}).keys())
    fallback_suggestions = {
        mt: foods
        for mt, foods in (suggestions.get('suggestions') or {}).items()
        if mt not in planned_types
    }
    
    # Schedule
    schedule = toddler.get_recommended_schedule()
    all_meals = schedule['meals'] + schedule['snacks']
    eaten_meals = set(log.meal_type for log in today_logs)
    logging_stats = _logging_stats_for_toddler(toddler_id, today)
    
    return jsonify({
        'toddler': toddler.to_dict(),
        'today': today.isoformat(),
        'schedule': schedule,
        'meals_eaten': list(eaten_meals),
        'meals_remaining': [m for m in all_meals if m not in eaten_meals],
        'today_logs': [l.to_dict() for l in today_logs],
        'today_plan': today_plan,
        'nutrition': nutrition,
        'alerts': alerts[:3],  # Top 3 alerts
        'alerts_total': len(alerts),
        'suggestions': fallback_suggestions,
        'logging_stats': logging_stats,
    })


# ==================== REACT-PORTED FEATURES: SAFETY / CHAT / RECIPES / USDA ====================

@app.route('/api/recipes', methods=['GET'])
def api_recipes():
    q = request.args.get('q')
    category = request.args.get('category')
    return jsonify({'recipes': list_recipes(category=category, q=q)})


@app.route('/api/recipes/<slug>', methods=['GET'])
def api_recipe_detail(slug):
    recipe = get_recipe(slug)
    if not recipe:
        return jsonify({'error': 'Recipe not found'}), 404
    return jsonify({'recipe': recipe})


@app.route('/api/recipes/for-food', methods=['GET'])
def api_recipe_for_food():
    name = request.args.get('name', '').strip()
    recipe = find_recipe_for_food_name(name)
    if not recipe:
        return jsonify({'recipe': None})
    return jsonify({'recipe': recipe})


@app.route('/api/food-safety/rules', methods=['GET'])
def api_food_safety_rules():
    return jsonify({'rules': safety_rules_for_prompt()})


@app.route('/api/food-safety/check', methods=['POST'])
def api_food_safety_check():
    data = request.json or {}
    if data.get('foods'):
        return jsonify({'flagged': check_foods_safety(data['foods'])})
    food = data.get('food') or data
    return jsonify({'warnings': check_food_safety(food)})


@app.route('/api/foods/<int:food_id>/safety', methods=['GET'])
def api_food_safety_by_id(food_id):
    food = Food.query.get_or_404(food_id)
    payload = food.to_dict()
    return jsonify({'food_id': food_id, 'warnings': check_food_safety(payload)})


@app.route('/api/nutrition/usda/health', methods=['GET'])
def api_usda_health():
    return jsonify({'ok': True, 'usingDemoKey': usda_using_demo_key()})


@app.route('/api/nutrition/usda/search', methods=['GET'])
def api_usda_search():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'error': 'Missing ?q= search term'}), 400
    try:
        return jsonify(usda_search_foods(q))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 502


@app.route('/api/nutrition/usda/food/<int:fdc_id>', methods=['GET'])
def api_usda_food(fdc_id):
    try:
        return jsonify(usda_get_food(fdc_id))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 502


@app.route('/api/chat/health', methods=['GET'])
def api_chat_health():
    if not can_use_chat_assistant():
        return jsonify({
            'ok': False,
            'configured': chat_configured(),
            'feature_enabled': is_chat_feature_enabled(),
            'premium_required': True,
            'available': False,
        })
    return jsonify({
        'ok': chat_configured(),
        'configured': chat_configured(),
        'feature_enabled': True,
        'available': True,
    })


def _chat_context_for_toddler(toddler):
    """Build plan + food list context for the chat system prompt."""
    today = date.today()
    planner = MealPlanner(db.session)
    week_start = today - timedelta(days=today.weekday())
    weekly = planner.generate_weekly_plan(toddler, week_start, regenerate=False)
    today_plan = next(
        (d for d in weekly.get('days', []) if d.get('date') == today.isoformat()),
        None,
    )
    plan_meals = (today_plan or {}).get('meals') or {}

    # Flatten plan meal entries to simple dicts for the prompt
    flat_plan = {}
    for slot, entry in plan_meals.items():
        if isinstance(entry, dict):
            flat_plan[slot] = {
                'name': entry.get('name') or entry.get('food_name') or entry.get('meal'),
                'notes': entry.get('notes') or entry.get('add') or '',
                'is_exposure': entry.get('is_exposure') or False,
            }
        else:
            flat_plan[slot] = {'name': str(entry)}

    prefs = {
        p.food_id: p
        for p in FoodPreference.query.filter_by(toddler_id=toddler.id).all()
    }
    foods = []
    for food in Food.query.limit(120).all():
        d = food.to_dict()
        pref = prefs.get(food.id)
        if pref:
            d['times_offered'] = pref.times_offered
            d['times_accepted'] = pref.times_accepted
            d['exposure_status'] = pref.get_exposure_status()
        else:
            d['times_offered'] = 0
            d['times_accepted'] = 0
            d['exposure_status'] = 'new'
        foods.append(d)

    return flat_plan, foods


def _apply_chat_food_feedback(toddler, args, foods):
    """Apply log_food_feedback tool — maps React responses onto Flask MealLog + preferences."""
    response = (args or {}).get('response') or 'note_only'
    note = (args or {}).get('note') or ''
    food_name = (args or {}).get('foodName') or (args or {}).get('food_name') or ''
    match = find_matching_food(foods, food_name) if food_name else None

    reaction_map = {
        'accepted': 'loved',
        'partial': 'neutral',
        'refused': 'refused',
        'note_only': None,
    }
    reaction = reaction_map.get(response)

    result = {
        'logged': False,
        'response': response,
        'note': note,
        'matched_food': match.get('name') if match else None,
    }

    if response == 'note_only' or not match or not reaction:
        result['message'] = note or 'Noted for future planning.'
        return result

    food_id = match.get('id')
    food = Food.query.get(food_id) if food_id else None
    if not food:
        result['message'] = note or 'Could not match that food in the database.'
        return result

    log = MealLog(
        toddler_id=toddler.id,
        food_id=food.id,
        date=date.today(),
        meal_type='snack',
        portion_eaten_percent=100 if reaction == 'loved' else (50 if reaction == 'neutral' else 0),
        toddler_reaction=reaction,
        notes=note or f'Logged via chat assistant ({response})',
    )
    db.session.add(log)

    pref = FoodPreference.query.filter_by(toddler_id=toddler.id, food_id=food.id).first()
    if not pref:
        pref = FoodPreference(toddler_id=toddler.id, food_id=food.id)
        db.session.add(pref)
    pref.update_from_reaction(reaction)
    db.session.commit()

    result['logged'] = True
    result['meal_log_id'] = log.id
    result['message'] = f"Logged {food.name} as {reaction}."
    return result


@app.route('/api/chat', methods=['POST'])
def api_chat():
    """
    OpenAI chat assistant for a toddler profile.
    Body: {
      toddler_id,
      messages: [{role, content}, ...],   # typically last ≤10 turns
      summary: optional rolling summary of older turns
    }
    Handles one optional tool round-trip server-side.
    Premium-only; also requires FEATURE_CHAT_ENABLED=true.
    """
    if not can_use_chat_assistant():
        return _chat_access_denied_response()

    data = request.json or {}
    toddler_id = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))
    messages = data.get('messages') or []
    summary = (data.get('summary') or '').strip()
    if not toddler_id:
        return jsonify({'error': 'toddler_id is required'}), 400
    if not messages:
        return jsonify({'error': 'messages array is required'}), 400

    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403

    if not chat_configured():
        return jsonify({
            'error': 'OPENAI_API_KEY is not set. Add it to .env and restart the app.'
        }), 501

    plan_meals, foods = _chat_context_for_toddler(toddler)
    system_prompt = build_system_prompt(
        toddler_name=toddler.name,
        age_months=toddler.age_months,
        today_label=date.today().strftime('%A, %B %d'),
        plan_meals=plan_meals,
        foods=foods,
    )
    if summary:
        system_prompt += (
            "\n\nSession memory (earlier messages in this visit, summarized):\n"
            f"{summary}\n"
            "Use this memory for continuity; prefer the latest explicit user messages if they conflict."
        )

    api_messages = [{'role': 'system', 'content': system_prompt}]
    for m in messages:
        role = m.get('role')
        content = m.get('content')
        if role in ('user', 'assistant') and content:
            api_messages.append({'role': role, 'content': content})

    tool_results = []
    try:
        first = call_openai_chat(messages=api_messages, tools=CHAT_TOOLS)
        choice = (first.get('choices') or [{}])[0]
        assistant_msg = choice.get('message') or {}

        tool_calls = assistant_msg.get('tool_calls') or []
        if tool_calls:
            api_messages.append(assistant_msg)
            for call in tool_calls:
                fn = (call.get('function') or {})
                name = fn.get('name')
                try:
                    args = _json.loads(fn.get('arguments') or '{}')
                except Exception:
                    args = {}
                if name == 'log_food_feedback':
                    result = _apply_chat_food_feedback(toddler, args, foods)
                    tool_results.append({'tool': name, 'result': result})
                    content = _json.dumps(result)
                elif name == 'update_weekly_plan':
                    planner = MealPlanner(db.session)
                    result = planner.apply_future_plan_updates(toddler, args.get('changes') or [])
                    tool_results.append({'tool': name, 'result': result})
                    content = _json.dumps(result)
                    app_log(
                        'chat update_weekly_plan',
                        toddler_id=toddler.id,
                        args=args,
                        result=result,
                    )
                else:
                    content = _json.dumps({'error': f'Unknown tool {name}'})
                api_messages.append({
                    'role': 'tool',
                    'tool_call_id': call.get('id'),
                    'content': content,
                })
            second = call_openai_chat(messages=api_messages, tools=CHAT_TOOLS)
            choice = (second.get('choices') or [{}])[0]
            assistant_msg = choice.get('message') or {}

        reply = assistant_msg.get('content') or 'Got it.'
        return jsonify({
            'message': {'role': 'assistant', 'content': reply},
            'tool_result': tool_results[0]['result'] if len(tool_results) == 1 else None,
            'tool_results': tool_results,
        })
    except ChatConfigError as exc:
        status = 501 if exc.code == 'NO_API_KEY' else 400
        return jsonify({'error': str(exc)}), status
    except ChatRequestError as exc:
        return jsonify({'error': str(exc)}), exc.status
    except Exception as exc:
        return jsonify({'error': f'Chat failed: {exc}'}), 502


@app.route('/api/chat/summarize', methods=['POST'])
def api_chat_summarize():
    """
    Fold older chat turns into a rolling session summary.
    Body: { toddler_id, messages: [...], prior_summary?: string }
    Premium-only; also requires FEATURE_CHAT_ENABLED=true.
    """
    if not can_use_chat_assistant():
        return _chat_access_denied_response()

    data = request.json or {}
    toddler_id = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))
    messages = data.get('messages') or []
    prior_summary = data.get('prior_summary') or data.get('summary') or ''

    if not toddler_id:
        return jsonify({'error': 'toddler_id is required'}), 400

    toddler = Toddler.query.get_or_404(toddler_id)
    if not owns_toddler(toddler):
        return jsonify({'error': 'Not authorized'}), 403

    if not messages and not (prior_summary or '').strip():
        return jsonify({'summary': ''})

    summary = summarize_chat_history(
        messages=messages,
        prior_summary=prior_summary,
        toddler_name=toddler.name,
    )
    return jsonify({'summary': summary})


# ==================== ADMIN DASHBOARD ====================

@app.route('/admin/sw.js')
def admin_service_worker():
    """Serve admin PWA service worker with /admin scope."""
    from flask import send_from_directory, make_response
    response = make_response(
        send_from_directory(
            Path(app.root_path) / 'static',
            'admin-sw.js',
            mimetype='application/javascript',
        )
    )
    response.headers['Service-Worker-Allowed'] = '/admin'
    response.headers['Cache-Control'] = 'no-cache'
    return response


@app.route('/admin', methods=['GET'])
def admin_dashboard():
    """Operator dashboard. Shows env-based login when not authenticated."""
    if not admin_configured():
        return render_template('404.html'), 404
    if not is_admin_session():
        return render_template('admin/login.html', error=None)
    return render_template(
        'admin/dashboard.html',
        toddler=None,
        toddlers=[],
        admin_email=session.get('admin_email'),
    )


@app.route('/admin/login', methods=['POST'])
def admin_login():
    """Authenticate with ADMIN_EMAILS + ADMIN_PASSWORD from .env."""
    if not admin_configured():
        return render_template('404.html'), 404

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''

    if email in get_admin_emails() and _admin_password_matches(password):
        session.permanent = True
        session['admin_authenticated'] = True
        session['admin_email'] = email
        return redirect(url_for('admin_dashboard'))

    return render_template(
        'admin/login.html',
        error='Invalid email or password.',
        email=email,
    ), 401


@app.route('/admin/logout', methods=['GET', 'POST'])
def admin_logout():
    clear_admin_session()
    if not admin_configured():
        return render_template('404.html'), 404
    return redirect(url_for('admin_dashboard'))


@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def api_admin_stats():
    """JSON analytics for the admin dashboard."""
    try:
        recent_days = int(request.args.get('range', 30))
    except (TypeError, ValueError):
        recent_days = 30
    recent_days = max(7, min(recent_days, 90))
    stats = build_admin_stats(db.session, recent_days=recent_days)
    return jsonify(stats)


@app.route('/admin/content')
def admin_content_page():
    """Admin CMS: recipes (with video/cover) and shared food catalog items."""
    if not admin_configured():
        return render_template('404.html'), 404
    if not is_admin_session():
        return redirect(url_for('admin_dashboard'))
    return render_template(
        'admin/content.html',
        toddler=None,
        toddlers=[],
        admin_email=session.get('admin_email'),
        food_categories=FOOD_CATEGORIES,
    )


def _parse_food_names(raw):
    if isinstance(raw, list):
        names = [str(x).strip() for x in raw if str(x).strip()]
    else:
        names = [p.strip() for p in str(raw or '').replace('\n', ',').split(',') if p.strip()]
    return names


def _unique_recipe_slug(base_name, exclude_id=None):
    base = slugify_recipe_name(base_name)
    slug = base
    n = 2
    while True:
        q = Recipe.query.filter_by(slug=slug)
        if exclude_id:
            q = q.filter(Recipe.id != exclude_id)
        if not q.first():
            return slug
        slug = f'{base}-{n}'
        n += 1


@app.route('/api/admin/recipes', methods=['GET'])
@admin_required
def api_admin_list_recipes():
    rows = Recipe.query.order_by(Recipe.sort_order.desc(), Recipe.created_at.desc()).all()
    return jsonify({'recipes': [r.to_admin_dict() for r in rows]})


@app.route('/api/admin/recipes', methods=['POST'])
@admin_required
def api_admin_create_recipe():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Recipe name is required'}), 400

    food_names = _parse_food_names(data.get('food_names'))
    if name not in food_names:
        food_names = [name] + food_names

    video_url = (data.get('video_url') or '').strip() or None
    platform = detect_video_platform(video_url) if video_url else None
    cover_path = None
    if data.get('cover_image_data'):
        cover_path = _save_recipe_cover(data['cover_image_data'])
        if not cover_path:
            return jsonify({'error': 'Invalid cover image (use PNG/JPG/WebP under 4MB)'}), 400

    recipe = Recipe(
        slug=_unique_recipe_slug(name),
        name=name,
        category=(data.get('category') or 'combo').strip().lower(),
        why=(data.get('why') or '').strip() or None,
        cheese=(data.get('cheese') or '').strip() or None,
        steps=(data.get('steps') or '').strip() or None,
        food_names=food_names,
        allergens=data.get('allergens') if isinstance(data.get('allergens'), list) else [],
        suitable_from_months=int(data['suitable_from_months']) if data.get('suitable_from_months') not in (None, '') else None,
        cover_image_path=cover_path or (data.get('cover_image_path') or None),
        video_url=video_url,
        video_platform=platform,
        is_published=bool(data.get('is_published', True)),
        sort_order=int(data.get('sort_order') or 0),
        source='admin',
        created_by_email=session.get('admin_email'),
    )
    db.session.add(recipe)
    db.session.commit()
    return jsonify({'recipe': recipe.to_admin_dict(), 'message': 'Recipe published for all users'}), 201


@app.route('/api/admin/recipes/<int:recipe_id>', methods=['PUT'])
@admin_required
def api_admin_update_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.get_json(silent=True) or {}

    if 'name' in data and (data.get('name') or '').strip():
        recipe.name = data['name'].strip()
        if data.get('rename_slug'):
            recipe.slug = _unique_recipe_slug(recipe.name, exclude_id=recipe.id)
    if 'category' in data:
        recipe.category = (data.get('category') or 'combo').strip().lower()
    if 'why' in data:
        recipe.why = (data.get('why') or '').strip() or None
    if 'cheese' in data:
        recipe.cheese = (data.get('cheese') or '').strip() or None
    if 'steps' in data:
        recipe.steps = (data.get('steps') or '').strip() or None
    if 'food_names' in data:
        names = _parse_food_names(data.get('food_names'))
        if recipe.name not in names:
            names = [recipe.name] + names
        recipe.food_names = names
    if 'suitable_from_months' in data:
        raw = data.get('suitable_from_months')
        recipe.suitable_from_months = int(raw) if raw not in (None, '') else None
    if 'is_published' in data:
        recipe.is_published = bool(data.get('is_published'))
    if 'sort_order' in data:
        recipe.sort_order = int(data.get('sort_order') or 0)
    if 'video_url' in data:
        recipe.video_url = (data.get('video_url') or '').strip() or None
        recipe.video_platform = detect_video_platform(recipe.video_url)
    if data.get('cover_image_data'):
        cover_path = _save_recipe_cover(data['cover_image_data'])
        if not cover_path:
            return jsonify({'error': 'Invalid cover image'}), 400
        recipe.cover_image_path = cover_path
    elif 'cover_image_path' in data and data.get('cover_image_path') is None:
        recipe.cover_image_path = None

    recipe.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'recipe': recipe.to_admin_dict(), 'message': 'Recipe updated'})


@app.route('/api/admin/recipes/<int:recipe_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Recipe deleted'})


@app.route('/api/admin/foods', methods=['GET'])
@admin_required
def api_admin_list_foods():
    """List admin/catalog foods (newest user/admin-added first, then sample of all)."""
    added = (
        Food.query
        .filter_by(is_user_added=True)
        .order_by(Food.id.desc())
        .limit(100)
        .all()
    )
    return jsonify({
        'foods': [f.to_dict() for f in added],
        'categories': FOOD_CATEGORIES,
        'note': 'Showing recently added catalog items. Admin-created items are available to all users for logging and planning.',
    })


@app.route('/api/admin/foods', methods=['POST'])
@admin_required
def api_admin_create_food():
    """Add a shared food/meal item to the global catalog for all users."""
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Food name is required'}), 400

    existing = Food.query.filter(db.func.lower(Food.name) == name.lower()).first()
    if existing:
        return jsonify({
            **existing.to_dict(),
            'already_existed': True,
            'message': f'"{existing.name}" already exists in the catalog',
        }), 200

    category = (data.get('category') or '').strip().lower()
    if category not in FOOD_CATEGORIES:
        category = guess_category(name)

    food = Food(
        name=name,
        name_hindi=(data.get('name_hindi') or '').strip() or None,
        category=category,
        calories=float(data.get('calories') or 0),
        protein_g=float(data.get('protein_g') or 0),
        carbs_g=float(data.get('carbs_g') or 0),
        fat_g=float(data.get('fat_g') or 0),
        fiber_g=float(data.get('fiber_g') or 0),
        calcium_mg=float(data.get('calcium_mg') or 0),
        iron_mg=float(data.get('iron_mg') or 0),
        zinc_mg=float(data.get('zinc_mg') or 0),
        vitamin_a_mcg=float(data.get('vitamin_a_mcg') or 0),
        vitamin_c_mg=float(data.get('vitamin_c_mg') or 0),
        vitamin_d_mcg=float(data.get('vitamin_d_mcg') or 0),
        spice_level=int(data.get('spice_level') or 0),
        texture=data.get('texture') or 'soft',
        allergens=data.get('allergens') if isinstance(data.get('allergens'), list) else [],
        suitable_from_months=int(data.get('suitable_from_months') or 12),
        serving_size_6_12=float(data.get('serving_size_6_12') or 50),
        serving_size_12_24=float(data.get('serving_size_12_24') or 75),
        serving_size_24_36=float(data.get('serving_size_24_36') or 100),
        toddler_friendly_version=(data.get('toddler_friendly_version') or '').strip() or f'Admin catalog item: {name}',
        preparation_tips=(data.get('preparation_tips') or '').strip() or None,
        is_user_added=True,  # marks as non-seed; shared for all users via Food table
        nutrition_pending=bool(data.get('enrich', False)) and not data.get('calories'),
        nutrition_source='admin' if data.get('calories') else None,
    )
    db.session.add(food)
    db.session.commit()

    if data.get('enrich') and food.nutrition_pending:
        _enqueue_food_enrichment(food.id)

    # Optionally also create a recipe card linked to this food
    created_recipe = None
    if data.get('also_create_recipe'):
        recipe = Recipe(
            slug=_unique_recipe_slug(name),
            name=name,
            category=category if category != 'fruit' else 'snack',
            why=food.toddler_friendly_version,
            steps=food.preparation_tips or food.toddler_friendly_version,
            food_names=[name],
            allergens=food.allergens or [],
            suitable_from_months=food.suitable_from_months,
            video_url=(data.get('video_url') or '').strip() or None,
            video_platform=detect_video_platform(data.get('video_url')),
            is_published=True,
            source='admin',
            created_by_email=session.get('admin_email'),
        )
        if data.get('cover_image_data'):
            recipe.cover_image_path = _save_recipe_cover(data['cover_image_data'])
        db.session.add(recipe)
        db.session.commit()
        created_recipe = recipe.to_admin_dict()

    result = food.to_dict()
    result['already_existed'] = False
    result['recipe'] = created_recipe
    result['message'] = f'Added "{food.name}" for all users'
    return jsonify(result), 201


@app.route('/api/analytics/collect', methods=['POST'])
def api_analytics_collect():
    """Receive first-party page view / heartbeat / leave beacons."""
    data = request.get_json(silent=True)
    if data is None and request.data:
        try:
            data = _json.loads(request.data.decode('utf-8'))
        except Exception:
            data = None
    data = data or {}

    event_type = (data.get('event_type') or '').strip().lower()
    if event_type not in ('page_view', 'heartbeat', 'page_leave', 'action'):
        return jsonify({'error': 'invalid event_type'}), 400

    # Do not track admin UI itself
    path = data.get('path') or request.path
    if str(path).startswith('/admin'):
        return jsonify({'ok': True, 'skipped': True})

    toddler_id = resolve_toddler_id(data.get('toddler_id') or data.get('toddler_ref'))

    # Soft rate limit: skip if this session sent >120 events in the last minute
    sid = get_session_id()
    one_min_ago = datetime.utcnow() - timedelta(seconds=60)
    recent = (
        AnalyticsEvent.query
        .filter(
            AnalyticsEvent.session_id == sid,
            AnalyticsEvent.created_at >= one_min_ago,
        )
        .count()
    )
    if recent >= 120:
        return jsonify({'ok': True, 'skipped': True})

    record_analytics_event(
        db.session,
        event_type=event_type,
        path=path,
        referrer=data.get('referrer'),
        duration_ms=data.get('duration_ms'),
        action_name=data.get('action_name') or (data.get('meta') or {}).get('action'),
        toddler_id=toddler_id,
        meta=data.get('meta') if isinstance(data.get('meta'), dict) else None,
        session_id=sid,
    )
    return jsonify({'ok': True})


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
