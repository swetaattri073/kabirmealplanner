"""
Admin analytics helpers for LittleBowl.

Aggregates users, toddlers, meal-logging engagement, and product-mix signals
so operators can see whether parents are actually using the app.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import distinct, func

from models import MealLog, Toddler, User, WeeklyPlan, FoodPreference, Food, AnalyticsEvent, AuditLog


def _iso(d):
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.isoformat()
    if isinstance(d, date):
        return d.isoformat()
    return str(d)


def _median(values):
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2


def _path_bucket(path):
    p = (path or '/').split('?')[0]
    if p.startswith('action:'):
        return p
    parts = [x for x in p.split('/') if x]
    if not parts:
        return '/'
    root = parts[0]
    known = {
        'dashboard', 'log-meal', 'weekly-plan', 'nutrition', 'preferences',
        'recipes', 'onboarding', 'signup', 'login', 'home', 'profile',
    }
    if root in known:
        return f'/{root}' + ('/:id' if len(parts) > 1 and parts[1].isdigit() else '')
    if root == 'api':
        return '/api/…'
    return '/' + root


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


def _build_traffic_and_funnel(db_session, now, week_ago_dt, month_ago_dt, users, toddlers, log_by_toddler):
    """Visit/time/action/funnel stats from AnalyticsEvent + product tables."""
    limitations = [
        'Visit and time-on-site data only exist after this analytics feature was deployed — older history cannot be recovered.',
        'Duration is approximate (visible-tab time via heartbeats / page leave), not exact engagement.',
        'Visitors with JavaScript disabled or blocked are undercounted.',
        'We cannot see scroll depth, rage clicks, heatmaps, or marketing attribution (UTM/ads) unless added later.',
        'Guest→signup linking is imperfect after toddlers transfer to a user account.',
    ]

    first_event = db_session.query(func.min(AnalyticsEvent.created_at)).scalar()
    event_count = db_session.query(func.count(AnalyticsEvent.id)).scalar() or 0

    if not event_count:
        return {
            'available': False,
            'instrumentation_since': None,
            'limitations': limitations + [
                'No analytics events recorded yet. Open the site in a browser after deploy to start collecting visits.',
            ],
            'visits': {},
            'time_on_site': {},
            'top_pages': [],
            'actions': {},
            'funnel': {'steps': [], 'drop_offs': []},
            'stuck_insights': [
                {
                    'title': 'Waiting for visit data',
                    'detail': 'Until parents browse the live site, we can only use signup / toddler / meal-log tables for engagement — not page visits or stay time.',
                }
            ],
        }

    def _window_stats(since_dt):
        page_views = (
            AnalyticsEvent.query
            .filter(
                AnalyticsEvent.created_at >= since_dt,
                AnalyticsEvent.event_type == 'page_view',
            )
            .count()
        )
        sessions = (
            db_session.query(func.count(distinct(AnalyticsEvent.session_id)))
            .filter(
                AnalyticsEvent.created_at >= since_dt,
                AnalyticsEvent.session_id.isnot(None),
            )
            .scalar()
            or 0
        )
        return page_views, int(sessions)

    pv7, sess7 = _window_stats(week_ago_dt)
    pv30, sess30 = _window_stats(month_ago_dt)

    events_7d = (
        AnalyticsEvent.query
        .filter(AnalyticsEvent.created_at >= week_ago_dt)
        .order_by(AnalyticsEvent.created_at.asc())
        .all()
    )
    by_session = defaultdict(list)
    for ev in events_7d:
        if ev.session_id:
            by_session[ev.session_id].append(ev)

    session_seconds = []
    for _sid, evs in by_session.items():
        max_dur = 0
        for ev in evs:
            if ev.duration_ms and ev.event_type in ('heartbeat', 'page_leave'):
                max_dur = max(max_dur, ev.duration_ms)
        if max_dur > 0:
            session_seconds.append(max_dur / 1000.0)
        elif len(evs) >= 2 and evs[0].created_at and evs[-1].created_at:
            span = (evs[-1].created_at - evs[0].created_at).total_seconds()
            if span > 0:
                session_seconds.append(min(span, 4 * 3600))

    page_rows = (
        db_session.query(AnalyticsEvent.path, func.count(AnalyticsEvent.id))
        .filter(
            AnalyticsEvent.created_at >= week_ago_dt,
            AnalyticsEvent.event_type == 'page_view',
        )
        .group_by(AnalyticsEvent.path)
        .all()
    )
    page_counter = Counter()
    for path, count in page_rows:
        page_counter[_path_bucket(path)] += int(count)
    top_pages = [{'path': p, 'views': c} for p, c in page_counter.most_common(12)]

    action_events = (
        AnalyticsEvent.query
        .filter(
            AnalyticsEvent.created_at >= week_ago_dt,
            AnalyticsEvent.event_type == 'action',
        )
        .all()
    )
    named_actions = Counter()
    for ev in action_events:
        name = None
        if ev.meta and isinstance(ev.meta, dict):
            name = ev.meta.get('action')
        if not name and ev.path and ev.path.startswith('action:'):
            name = ev.path.split(':', 1)[1]
        named_actions[name or 'unknown'] += 1

    audit_rows = (
        db_session.query(AuditLog.action, func.count(AuditLog.id))
        .filter(AuditLog.created_at >= week_ago_dt)
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(15)
        .all()
    )
    audit_actions = {a: int(c) for a, c in audit_rows}

    events_30d = (
        AnalyticsEvent.query
        .filter(AnalyticsEvent.created_at >= month_ago_dt)
        .all()
    )
    session_flags = defaultdict(lambda: {
        'landing': False, 'signup_page': False, 'login_page': False,
        'onboarding': False, 'dashboard': False, 'log_meal_page': False,
        'weekly_plan': False, 'nutrition': False, 'preferences': False,
        'action_signup': False, 'action_toddler': False, 'action_meal': False,
        'user_id': None,
    })
    for ev in events_30d:
        if not ev.session_id:
            continue
        f = session_flags[ev.session_id]
        if ev.user_id:
            f['user_id'] = ev.user_id
        p = (ev.path or '')
        if ev.event_type == 'page_view':
            if p == '/' or p.startswith('/?'):
                f['landing'] = True
            elif p.startswith('/signup'):
                f['signup_page'] = True
            elif p.startswith('/login'):
                f['login_page'] = True
            elif p.startswith('/onboarding'):
                f['onboarding'] = True
            elif p.startswith('/dashboard'):
                f['dashboard'] = True
            elif p.startswith('/log-meal'):
                f['log_meal_page'] = True
            elif p.startswith('/weekly-plan'):
                f['weekly_plan'] = True
            elif p.startswith('/nutrition'):
                f['nutrition'] = True
            elif p.startswith('/preferences'):
                f['preferences'] = True
        if ev.event_type == 'action':
            an = (ev.meta or {}).get('action') if isinstance(ev.meta, dict) else None
            if not an and p.startswith('action:'):
                an = p.split(':', 1)[1]
            if an == 'user.signup':
                f['action_signup'] = True
            elif an == 'toddler.created':
                f['action_toddler'] = True
            elif an == 'meal.logged':
                f['action_meal'] = True

    for t in toddlers:
        if t.session_id and t.session_id in session_flags:
            session_flags[t.session_id]['action_toddler'] = True

    def count_flag(key):
        return sum(1 for f in session_flags.values() if f.get(key))

    visitors = len(session_flags) or 0
    saw_landing = count_flag('landing') or visitors
    saw_onboarding = count_flag('onboarding')
    created_toddler = count_flag('action_toddler')
    signed_up = count_flag('action_signup')
    users_new_30 = sum(1 for u in users if u.created_at and u.created_at >= month_ago_dt)
    signed_up_effective = max(signed_up, users_new_30)
    logged_meal = count_flag('action_meal')
    saw_log_meal_page = count_flag('log_meal_page')

    funnel_steps = [
        {'key': 'visitors', 'label': 'Site visitors (sessions)', 'count': int(visitors)},
        {'key': 'landing', 'label': 'Viewed landing page', 'count': int(saw_landing)},
        {'key': 'onboarding', 'label': 'Opened onboarding', 'count': int(saw_onboarding)},
        {'key': 'toddler', 'label': 'Created toddler profile', 'count': int(created_toddler)},
        {'key': 'signup', 'label': 'Signed up (account)', 'count': int(signed_up_effective)},
        {'key': 'log_meal_page', 'label': 'Opened Log Meal', 'count': int(saw_log_meal_page)},
        {'key': 'meal', 'label': 'Logged at least one meal', 'count': int(logged_meal)},
    ]

    drop_offs = []
    pairs = [
        ('visitors', 'onboarding', 'Visited but never started onboarding',
         ['Landing CTA unclear or not compelling', 'Browsing / bouncing without intent', 'Mobile load or trust concerns']),
        ('onboarding', 'toddler', 'Started onboarding but did not create a profile',
         ['Form friction (too many fields)', 'Interrupted mid-flow', 'Unsure about sharing child data']),
        ('toddler', 'meal', 'Created a toddler but never logged a meal',
         ['Did not understand next step after profile', 'Logging feels like work', 'Came only to explore meal ideas']),
        ('log_meal_page', 'meal', 'Opened Log Meal but did not finish logging',
         ['Food search / reaction UI friction', 'Abandoned because meal was not in database', 'Left to cook and never returned']),
        ('toddler', 'signup', 'Used as guest but did not create an account',
         ['Signup not required so easy to leave', 'Privacy hesitation', 'Did not see value in saving progress']),
    ]
    step_map = {s['key']: s['count'] for s in funnel_steps}
    for a, b, title, reasons in pairs:
        left = step_map.get(a, 0)
        right = step_map.get(b, 0)
        if left <= 0:
            continue
        lost = max(0, left - right)
        drop_offs.append({
            'from': a,
            'to': b,
            'title': title,
            'from_count': left,
            'to_count': right,
            'lost': lost,
            'drop_pct': round(lost / left * 100, 1) if left else 0,
            'likely_reasons': reasons,
            'confidence': 'heuristic',
        })

    stuck = []
    guests_no_logs = [
        t for t in toddlers
        if not t.user_id and log_by_toddler.get(t.id, {}).get('log_count', 0) == 0
    ]
    if guests_no_logs:
        stuck.append({
            'title': f'{len(guests_no_logs)} guest toddler(s) with zero meals logged',
            'detail': 'Parents created a profile anonymously but never came back to log food — highest-risk drop after first session.',
        })

    uids_with_t = {t.user_id for t in toddlers if t.user_id}
    users_no_toddler = [u for u in users if u.id not in uids_with_t]
    if users_no_toddler:
        stuck.append({
            'title': f'{len(users_no_toddler)} registered user(s) with no toddler profile',
            'detail': 'Signed up but stalled before onboarding completed — account alone is not activation.',
        })

    users_with_t_no_logs = []
    for u in users:
        kids = [t for t in toddlers if t.user_id == u.id]
        if not kids:
            continue
        if all(log_by_toddler.get(t.id, {}).get('log_count', 0) == 0 for t in kids):
            users_with_t_no_logs.append(u)
    if users_with_t_no_logs:
        stuck.append({
            'title': f'{len(users_with_t_no_logs)} user(s) with toddlers but zero meal logs',
            'detail': 'They completed setup but are not forming the core habit (daily logging). Check Log Meal UX and reminders.',
        })

    bounceish = sum(
        1 for f in session_flags.values()
        if f['landing'] and not f['onboarding'] and not f['action_toddler'] and not f['dashboard']
    )
    if bounceish:
        stuck.append({
            'title': f'{bounceish} session(s) looked like landing-only visits (30d)',
            'detail': 'Saw marketing/home but did not enter the product. Improve hero CTA clarity or load speed — estimate from page views only.',
        })

    if not stuck:
        stuck.append({
            'title': 'No strong stuck segments detected yet',
            'detail': 'Either traffic is low or parents who arrive are converting into meal logs. Re-check after more visits accumulate.',
        })

    med = _median(session_seconds)
    avg = (sum(session_seconds) / len(session_seconds)) if session_seconds else None

    return {
        'available': True,
        'instrumentation_since': _iso(first_event),
        'limitations': limitations,
        'visits': {
            'page_views_7d': pv7,
            'page_views_30d': pv30,
            'unique_sessions_7d': sess7,
            'unique_sessions_30d': sess30,
        },
        'time_on_site': {
            'sessions_measured_7d': len(session_seconds),
            'median_seconds_7d': round(med, 1) if med is not None else None,
            'avg_seconds_7d': round(avg, 1) if avg is not None else None,
            'note': 'Based on visible-tab time from heartbeats/page leave when available; otherwise first→last event span.',
        },
        'top_pages': top_pages,
        'actions': {
            'named_product_actions_7d': dict(named_actions),
            'api_audit_actions_7d': audit_actions,
            'note': 'Named actions (signup, toddler created, meal logged) are explicit. API audit actions are mutating requests (not every click).',
        },
        'funnel': {
            'window_days': 30,
            'steps': funnel_steps,
            'drop_offs': drop_offs,
            'note': 'Funnel uses browser sessions + product events. Counts are not a perfect single-user journey.',
        },
        'stuck_insights': stuck,
    }


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
        'behavior': _build_traffic_and_funnel(
            db_session, now, week_ago_dt, month_ago_dt, users, toddlers, log_by_toddler
        ),
    }
