"""
File + database audit logging for API calls and toddler plan changes.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from flask import has_request_context, request
from flask_login import current_user

SENSITIVE_KEYS = {
    'password', 'password_hash', 'confirm_password', 'token', 'secret',
    'api_key', 'authorization', 'access_token', 'refresh_token', 'openai_api_key',
}

_file_logger: Optional[logging.Logger] = None
_audit_logger: Optional[logging.Logger] = None


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if str(k).lower() in SENSITIVE_KEYS:
                out[k] = '[REDACTED]'
            else:
                out[k] = _redact(v)
        return out
    if isinstance(value, list):
        return [_redact(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    try:
        return str(value)
    except Exception:
        return '<unserializable>'


def _safe_json(value: Any, limit: int = 8000) -> Any:
    redacted = _redact(value)
    try:
        raw = json.dumps(redacted, default=str)
    except Exception:
        raw = json.dumps({'error': 'could not serialize'}, default=str)
    if len(raw) > limit:
        return {'_truncated': True, '_preview': raw[:limit]}
    return redacted


def setup_logging(instance_dir: str) -> None:
    """Attach rotating file handlers under instance/logs/."""
    global _file_logger, _audit_logger

    log_dir = os.path.join(instance_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)

    fmt = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    def _make(name: str, filename: str, level: int = logging.INFO) -> logging.Logger:
        logger = logging.getLogger(name)
        logger.setLevel(level)
        logger.propagate = False
        # Avoid duplicate handlers on reload
        if not any(isinstance(h, RotatingFileHandler) and getattr(h, 'baseFilename', '').endswith(filename)
                   for h in logger.handlers):
            handler = RotatingFileHandler(
                os.path.join(log_dir, filename),
                maxBytes=5 * 1024 * 1024,
                backupCount=5,
            )
            handler.setFormatter(fmt)
            logger.addHandler(handler)
        return logger

    _file_logger = _make('littlebowl.app', 'app.log')
    _audit_logger = _make('littlebowl.audit', 'audit.log')
    _file_logger.info('File logging initialized at %s', log_dir)


def app_log(message: str, level: int = logging.INFO, **extra: Any) -> None:
    logger = _file_logger or logging.getLogger('littlebowl.app')
    if extra:
        message = f'{message} | {json.dumps(_safe_json(extra), default=str)}'
    logger.log(level, message)


def audit_file_log(message: str, payload: Optional[dict] = None) -> None:
    logger = _audit_logger or logging.getLogger('littlebowl.audit')
    if payload:
        message = f'{message} | {json.dumps(_safe_json(payload), default=str)}'
    logger.info(message)


def write_audit_log(
    *,
    action: str,
    toddler_id: Optional[int] = None,
    user_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    before: Any = None,
    after: Any = None,
    details: Any = None,
    source: str = 'api',
    commit: bool = True,
):
    """Persist an audit row and mirror it to audit.log."""
    from models import AuditLog, db

    if user_id is None and has_request_context():
        try:
            if current_user and getattr(current_user, 'is_authenticated', False):
                user_id = current_user.id
        except Exception:
            pass

    ip_address = None
    path = None
    method = None
    if has_request_context():
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip_address and ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        path = request.path
        method = request.method

    merged_details = _safe_json(details) if details is not None else {}
    if not isinstance(merged_details, dict):
        merged_details = {'value': merged_details}
    if path:
        merged_details.setdefault('path', path)
    if method:
        merged_details.setdefault('method', method)

    row = AuditLog(
        toddler_id=toddler_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        before_json=_safe_json(before) if before is not None else None,
        after_json=_safe_json(after) if after is not None else None,
        details=merged_details,
        source=source,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.session.add(row)
    if commit:
        db.session.commit()

    audit_file_log(
        action,
        {
            'toddler_id': toddler_id,
            'user_id': user_id,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'before': before,
            'after': after,
            'details': merged_details,
            'source': source,
        },
    )
    return row


def request_payload_snapshot() -> dict:
    """Capture request args/json/form for logging (secrets redacted)."""
    if not has_request_context():
        return {}
    snap: dict = {
        'path': request.path,
        'method': request.method,
        'args': dict(request.args),
    }
    if request.is_json:
        try:
            snap['json'] = request.get_json(silent=True)
        except Exception:
            snap['json'] = None
    elif request.form:
        snap['form'] = request.form.to_dict(flat=True)
    return _safe_json(snap)
