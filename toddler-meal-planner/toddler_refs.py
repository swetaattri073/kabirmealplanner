"""
Opaque toddler IDs for URLs.

Page and API path segments use a signed token instead of the raw integer
primary key, so the address bar does not leak sequential profile numbers.
Tokens are HMAC-signed with SECRET_KEY (itsdangerous) — not guessable and
not forgeable without the secret.
"""

from __future__ import annotations

from itsdangerous import BadSignature, URLSafeSerializer
from werkzeug.routing import BaseConverter


_SALT = 'littlebowl-toddler-ref-v1'
_serializer = None


def _get_serializer(secret_key: str) -> URLSafeSerializer:
    global _serializer
    if _serializer is None or getattr(_serializer, '_lb_secret', None) != secret_key:
        _serializer = URLSafeSerializer(secret_key, salt=_SALT)
        _serializer._lb_secret = secret_key
    return _serializer


def configure_toddler_refs(secret_key: str) -> None:
    """Bind serializer to the app SECRET_KEY (call once at startup)."""
    _get_serializer(secret_key)


def encode_toddler_ref(toddler_id: int, secret_key: str | None = None) -> str:
    if toddler_id is None:
        raise ValueError('toddler_id required')
    if secret_key:
        ser = _get_serializer(secret_key)
    else:
        if _serializer is None:
            raise RuntimeError('toddler refs not configured')
        ser = _serializer
    return ser.dumps(int(toddler_id))


def decode_toddler_ref(token: str, secret_key: str | None = None) -> int | None:
    if not token:
        return None
    token = str(token).strip()
    if secret_key:
        ser = _get_serializer(secret_key)
    else:
        if _serializer is None:
            return None
        ser = _serializer
    try:
        value = ser.loads(token)
        return int(value)
    except (BadSignature, TypeError, ValueError):
        return None


def resolve_toddler_id(value) -> int | None:
    """
    Accept an opaque ref OR a legacy integer id (for JSON bodies / old clients).
    """
    if value is None or value == '':
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        n = int(text)
        return n if n > 0 else None
    return decode_toddler_ref(text)


class ToddlerRefConverter(BaseConverter):
    """
    URL converter: path shows signed token; view receives integer toddler_id.

    url_for(..., toddler_id=3) → encodes to opaque segment.
    Incoming opaque segment → decoded int (404 if invalid).
    """

    regex = r'[^/]+'

    def to_python(self, value):
        from flask import abort

        # Legacy numeric segments still resolve so we can 302 → opaque URL.
        if str(value).isdigit():
            return int(value)
        tid = decode_toddler_ref(value)
        if tid is None:
            abort(404)
        return tid

    def to_url(self, value):
        if hasattr(value, 'id'):
            value = value.id
        return encode_toddler_ref(int(value))
