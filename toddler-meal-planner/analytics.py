"""
Lightweight first-party analytics for LittleBowl.

Tracks page views, session duration heartbeats, and named product actions.
Used by the admin dashboard — not a third-party SaaS.
"""

from __future__ import annotations

from datetime import datetime

from flask import request, session
from flask_login import current_user


ALLOWED_EVENT_TYPES = frozenset({'page_view', 'heartbeat', 'page_leave', 'action'})
MAX_PATH_LEN = 300
MAX_REFERRER_LEN = 500
MAX_ACTION_LEN = 80


def _client_ip():
    forwarded = (request.headers.get('X-Forwarded-For') or '').split(',')[0].strip()
    return forwarded or (request.remote_addr or '')[:64]


def normalize_path(path):
    raw = (path or request.path or '/').strip() or '/'
    if len(raw) > MAX_PATH_LEN:
        raw = raw[:MAX_PATH_LEN]
    # Strip query string for grouping
    if '?' in raw:
        raw = raw.split('?', 1)[0]
    return raw or '/'


def _ensure_anon_session_id():
    """Match app.get_session_id without importing app (avoids circular imports)."""
    if 'anonymous_session_id' not in session:
        from session_persist import GUEST_COOKIE_NAME, is_valid_guest_id, new_guest_id
        cookie_id = request.cookies.get(GUEST_COOKIE_NAME)
        if is_valid_guest_id(cookie_id):
            session['anonymous_session_id'] = cookie_id
        else:
            session['anonymous_session_id'] = new_guest_id()
        session.permanent = True
        session.modified = True
    return session['anonymous_session_id']


def record_analytics_event(
    db_session,
    *,
    event_type,
    path=None,
    referrer=None,
    duration_ms=None,
    action_name=None,
    toddler_id=None,
    meta=None,
    session_id=None,
):
    """Persist one analytics event. Safe no-op on bad input."""
    from models import AnalyticsEvent

    et = (event_type or '').strip().lower()
    if et not in ALLOWED_EVENT_TYPES:
        return None

    sid = session_id or _ensure_anon_session_id()

    user_id = None
    try:
        if current_user and current_user.is_authenticated:
            user_id = current_user.id
    except Exception:
        user_id = None

    path_val = normalize_path(path)
    ref = (referrer or '')[:MAX_REFERRER_LEN] or None

    details = dict(meta or {})
    if et == 'action' and action_name:
        details['action'] = str(action_name)[:MAX_ACTION_LEN]
        if path_val == '/' and action_name:
            path_val = f'action:{str(action_name)[:MAX_ACTION_LEN]}'

    dur = None
    if duration_ms is not None:
        try:
            dur = max(0, min(int(duration_ms), 24 * 60 * 60 * 1000))
        except (TypeError, ValueError):
            dur = None

    event = AnalyticsEvent(
        session_id=(sid or '')[:64] or None,
        user_id=user_id,
        toddler_id=toddler_id,
        event_type=et,
        path=path_val,
        referrer=ref,
        duration_ms=dur,
        meta=details or None,
        ip_address=_client_ip() or None,
        created_at=datetime.utcnow(),
    )
    db_session.add(event)
    try:
        db_session.commit()
    except Exception:
        db_session.rollback()
        return None
    return event
