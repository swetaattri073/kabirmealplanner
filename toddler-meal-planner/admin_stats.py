"""
Admin analytics helpers for LittleBowl.

Aggregates users, toddlers, meal-logging engagement, and product-mix signals
so operators can see whether parents are actually using the app.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import distinct, func

from models import MealLog, Toddler, User, WeeklyPlan, FoodPreference, Food


def _iso(d):
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.isoformat()
    if isinstance(d, date):
        return d.isoformat()
    return str(d)


def _age_bucket(months):
    if months is None:
        return 'unknown'
    if months < 12:
        return '6–11 mo'
    if months < 18:
        return '12–17 mo'
    if months < 24:
        return '18–23 mo'
    if months < 36:
        return '24–35 mo'
    return '36+ mo'


def build_admin_stats(db_session, recent_days=30, user_limit=200):
    """Return a JSON-serializable admin analytics payload."""
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=max(1, int(recent_days)))
    now = datetime.utcnow()
    week_ago_dt = now - timedelta(days=7)
    month_ago_dt = now - timedelta(days=max(1, int(recent_days)))

    users = User.query.order_by(User.created_at.desc()).all()
    toddlers = Toddler.query.order_by(Toddler.created_at.desc()).all()

    # Meal-log aggregates per toddler
    log_rows = (
        db_session.query(
            MealLog.toddler_id,
            func.count(MealLog.id).label('log_count'),
            func.count(distinct(MealLog.date)).label('days_logged'),
            func.min(MealLog.date).label('first_log'),
            func.max(MealLog.date).label('last_log'),
        )
        .group_by(MealLog.toddler_id)
        .all()
    )
    log_by_toddler = {
        row.toddler_id: {
            'log_count': int(row.log_count or 0),
            'days_logged': int(row.days_logged or 0),
            'first_log': row.first_log,
            'last_log': row.last_log,
        }
        for row in log_rows
    }

    # Recent activity windows
    logs_7d = MealLog.query.filter(MealLog.date >= week_ago).count()
    logs_30d = MealLog.query.filter(MealLog.date >= month_ago).count()
    active_toddlers_7d = (
        db_session.query(func.count(distinct(MealLog.toddler_id)))
        .filter(MealLog.date >= week_ago)
        .scalar()
        or 0
    )
    active_toddlers_30d = (
        db_session.query(func.count(distinct(MealLog.toddler_id)))
        .filter(MealLog.date >= month_ago)
        .scalar()
        or 0
    )
    active_logging_days_7d = (
        db_session.query(func.count(distinct(MealLog.date)))
        .filter(MealLog.date >= week_ago)
        .scalar()
        or 0
    )

    registered_toddlers = [t for t in toddlers if t.user_id]
    guest_toddlers = [t for t in toddlers if not t.user_id]

    toddlers_by_user = defaultdict(list)
    for t in toddlers:
        if t.user_id:
            toddlers_by_user[t.user_id].append(t)

    # Reaction mix (usefulness / feedback quality)
    reaction_rows = (
        db_session.query(MealLog.toddler_reaction, func.count(MealLog.id))
        .filter(MealLog.toddler_reaction.isnot(None))
        .group_by(MealLog.toddler_reaction)
        .all()
    )
    reactions = { (r or 'unknown'): int(c) for r, c in reaction_rows }

    # Meal-type coverage
    meal_type_rows = (
        db_session.query(MealLog.meal_type, func.count(MealLog.id))
        .group_by(MealLog.meal_type)
        .all()
    )
    meal_types = { (m or 'unknown'): int(c) for m, c in meal_type_rows }

    # Product / cohort mix
    diet_counts = Counter((t.dietary_preference or 'unknown') for t in toddlers)
    age_counts = Counter(_age_bucket(t.age_months) for t in toddlers)
    gender_counts = Counter((t.gender or 'unknown') for t in toddlers)

    photo_logs = MealLog.query.filter(
        MealLog.photo_path.isnot(None),
        MealLog.photo_path != '',
    ).count()
    adapted_logs = MealLog.query.filter(MealLog.is_adult_meal_adapted.is_(True)).count()
    custom_name_logs = MealLog.query.filter(
        MealLog.custom_food_name.isnot(None),
        MealLog.custom_food_name != '',
    ).count()
    user_added_foods = Food.query.filter_by(is_user_added=True).count() if hasattr(Food, 'is_user_added') else 0
    weekly_plans = WeeklyPlan.query.count()
    preference_rows = FoodPreference.query.count()

    total_logs = MealLog.query.count()
    users_with_toddlers = sum(1 for u in users if toddlers_by_user.get(u.id))
    users_new_7d = sum(1 for u in users if u.created_at and u.created_at >= week_ago_dt)
    users_new_30d = sum(1 for u in users if u.created_at and u.created_at >= month_ago_dt)
    premium_users = sum(1 for u in users if u.is_premium())

    def _user_engagement(u):
        kids = toddlers_by_user.get(u.id, [])
        kid_payload = []
        user_log_count = 0
        user_days = 0
        last_activity = None
        for t in kids:
            stats = log_by_toddler.get(t.id, {
                'log_count': 0,
                'days_logged': 0,
                'first_log': None,
                'last_log': None,
            })
            user_log_count += stats['log_count']
            user_days += stats['days_logged']
            if stats['last_log'] and (last_activity is None or stats['last_log'] > last_activity):
                last_activity = stats['last_log']
            kid_payload.append({
                'id': t.id,
                'name': t.name,
                'age_months': t.age_months,
                'dietary_preference': t.dietary_preference,
                'created_at': _iso(t.created_at),
                'log_count': stats['log_count'],
                'days_logged': stats['days_logged'],
                'first_log': _iso(stats['first_log']),
                'last_log': _iso(stats['last_log']),
                'active_last_7d': bool(stats['last_log'] and stats['last_log'] >= week_ago),
                'active_last_30d': bool(stats['last_log'] and stats['last_log'] >= month_ago),
            })

        activated = False
        if u.created_at and kid_payload:
            signup_day = u.created_at.date() if isinstance(u.created_at, datetime) else u.created_at
            for kid in kid_payload:
                if kid['first_log']:
                    first = date.fromisoformat(kid['first_log'])
                    if 0 <= (first - signup_day).days <= 7:
                        activated = True
                        break

        return {
            'id': u.id,
            'email': u.email,
            'name': u.name,
            'subscription_tier': u.subscription_tier or 'free',
            'is_premium': u.is_premium(),
            'is_active': bool(u.is_active),
            'created_at': _iso(u.created_at),
            'last_login': _iso(u.last_login),
            'toddler_count': len(kids),
            'log_count': user_log_count,
            'days_logged': user_days,
            'last_meal_log': _iso(last_activity),
            'activated_within_7d': activated,
            'toddlers': kid_payload,
            '_last_activity': last_activity,
        }

    all_user_rows = [_user_engagement(u) for u in users]
    users_with_logs = sum(1 for row in all_user_rows if row['log_count'] > 0)
    users_logged_last_7d = sum(
        1 for row in all_user_rows
        if row['_last_activity'] and row['_last_activity'] >= week_ago
    )
    activated_count = sum(1 for row in all_user_rows if row['activated_within_7d'])

    user_rows = []
    for row in all_user_rows[: max(1, int(user_limit))]:
        row = dict(row)
        row.pop('_last_activity', None)
        user_rows.append(row)

    # Daily log volume for sparkline (last 14 days)
    daily_volume = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        count = MealLog.query.filter(MealLog.date == d).count()
        daily_volume.append({'date': d.isoformat(), 'count': count})

    overview = {
        'users_total': len(users),
        'users_new_7d': users_new_7d,
        'users_new_30d': users_new_30d,
        'users_with_toddlers': users_with_toddlers,
        'users_with_logs': users_with_logs,
        'users_logged_last_7d': users_logged_last_7d,
        'premium_users': premium_users,
        'toddlers_total': len(toddlers),
        'toddlers_registered': len(registered_toddlers),
        'toddlers_guest': len(guest_toddlers),
        'meal_logs_total': total_logs,
        'meal_logs_7d': logs_7d,
        'meal_logs_30d': logs_30d,
        'active_toddlers_7d': int(active_toddlers_7d),
        'active_toddlers_30d': int(active_toddlers_30d),
        'active_logging_days_7d': int(active_logging_days_7d),
        'weekly_plans': weekly_plans,
        'food_preferences': preference_rows,
        'photo_logs': photo_logs,
        'adapted_meal_logs': adapted_logs,
        'custom_food_logs': custom_name_logs,
        'user_added_foods': user_added_foods,
        'activation_rate_pct': round(
            (activated_count / len(all_user_rows) * 100) if all_user_rows else 0, 1
        ),
        'pct_users_with_toddlers': round(
            (users_with_toddlers / len(users) * 100) if users else 0, 1
        ),
        'pct_users_with_logs': round(
            (users_with_logs / len(users) * 100) if users else 0, 1
        ),
    }

    guest_rows = []
    for t in guest_toddlers[:100]:
        stats = log_by_toddler.get(t.id, {
            'log_count': 0,
            'days_logged': 0,
            'first_log': None,
            'last_log': None,
        })
        guest_rows.append({
            'id': t.id,
            'name': t.name,
            'age_months': t.age_months,
            'session_id': (t.session_id or '')[:8] + '…' if t.session_id else None,
            'created_at': _iso(t.created_at),
            'log_count': stats['log_count'],
            'days_logged': stats['days_logged'],
            'last_log': _iso(stats['last_log']),
        })

    return {
        'generated_at': now.isoformat() + 'Z',
        'range_days': int(recent_days),
        'overview': overview,
        'users': user_rows,
        'guest_toddlers': guest_rows,
        'distributions': {
            'dietary_preference': dict(diet_counts),
            'age_bucket': dict(age_counts),
            'gender': dict(gender_counts),
            'reactions': reactions,
            'meal_types': meal_types,
        },
        'daily_meal_volume': daily_volume,
    }
