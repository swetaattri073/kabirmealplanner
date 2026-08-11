"""
Mobile / API auth helpers for LittleBowl native clients.

Web UI keeps cookie sessions. Native apps use:
  Authorization: Bearer <token>
  X-Guest-Id: <guest_id>   (anonymous)

Does not affect admin auth.
"""

from __future__ import annotations

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# 400 days — matches remember-cookie lifetime
API_TOKEN_MAX_AGE = 400 * 24 * 60 * 60
API_TOKEN_SALT = 'littlebowl-api-v1'


def _serializer(secret_key: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key, salt=API_TOKEN_SALT)


def issue_api_token(secret_key: str, user_id: int) -> str:
    return _serializer(secret_key).dumps({'uid': int(user_id)})


def verify_api_token(secret_key: str, token: str):
    """Return user_id or None."""
    if not token:
        return None
    try:
        data = _serializer(secret_key).loads(token, max_age=API_TOKEN_MAX_AGE)
        uid = data.get('uid')
        return int(uid) if uid is not None else None
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None
