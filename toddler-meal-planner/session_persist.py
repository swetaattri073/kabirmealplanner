"""
Guest session persistence helpers.

Problem: on mobile (especially installed PWAs / HTTP Docker), Flask session
cookies can be dropped. Guest toddlers are keyed by anonymous_session_id, so
losing the cookie looks like a brand-new visit → onboarding form again.

Fix layers:
1. Stable SECRET_KEY persisted under instance/.env (Docker volume)
2. Long-lived lb_guest_id cookie mirroring the guest session id
3. Client localStorage + /api/auth/restore to rehydrate when cookies are gone
"""

from __future__ import annotations

import os
import re
import secrets
from datetime import timedelta

GUEST_COOKIE_NAME = 'lb_guest_id'
GUEST_COOKIE_MAX_AGE = int(timedelta(days=400).total_seconds())
_GUEST_ID_RE = re.compile(r'^[a-f0-9]{32,128}$')
_DEFAULT_SECRET_PLACEHOLDERS = frozenset({
    '',
    'your-secret-key-change-this-in-production',
    'toddler-meal-planner-secret-key-change-in-production',
    'change-me',
})


def is_valid_guest_id(value: str | None) -> bool:
    if not value:
        return False
    return bool(_GUEST_ID_RE.match(str(value).strip()))


def new_guest_id() -> str:
    return secrets.token_hex(32)


def _read_env_key(env_path: str, key: str) -> str | None:
    if not os.path.isfile(env_path):
        return None
    try:
        with open(env_path, 'r', encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, _, v = line.partition('=')
                if k.strip() != key:
                    continue
                return v.strip().strip('"').strip("'")
    except OSError:
        return None
    return None


def _append_env_key(env_path: str, key: str, value: str) -> None:
    os.makedirs(os.path.dirname(env_path), exist_ok=True)
    existing = ''
    if os.path.isfile(env_path):
        with open(env_path, 'r', encoding='utf-8') as fh:
            existing = fh.read()
    # Replace existing key if present
    lines = existing.splitlines()
    out = []
    replaced = False
    for line in lines:
        if line.strip().startswith(f'{key}='):
            out.append(f'{key}={value}')
            replaced = True
        else:
            out.append(line)
    if not replaced:
        if out and out[-1].strip():
            out.append('')
        out.append(f'# Auto-generated so sessions survive container restarts')
        out.append(f'{key}={value}')
    with open(env_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out).rstrip() + '\n')


def ensure_persistent_secret_key(instance_dir: str, environ: dict | None = None) -> str:
    """
    Return a stable SECRET_KEY, writing one to instance/.env when missing.

    Without a stable key, every redeploy that falls back to the hard-coded
    default (or a newly generated ephemeral key) invalidates all sessions —
    guests then land on onboarding again.
    """
    env = environ if environ is not None else os.environ
    env_path = os.path.join(instance_dir, '.env')

    current = (env.get('SECRET_KEY') or '').strip()
    if current and current not in _DEFAULT_SECRET_PLACEHOLDERS:
        return current

    from_file = (_read_env_key(env_path, 'SECRET_KEY') or '').strip()
    if from_file and from_file not in _DEFAULT_SECRET_PLACEHOLDERS:
        env['SECRET_KEY'] = from_file
        return from_file

    generated = secrets.token_hex(32)
    try:
        _append_env_key(env_path, 'SECRET_KEY', generated)
    except OSError:
        pass
    env['SECRET_KEY'] = generated
    return generated


def cookie_secure_for_request(app_config_secure, request) -> bool:
    """Use Secure cookies only when the request is actually HTTPS."""
    if app_config_secure is True:
        return True
    try:
        return bool(request.is_secure)
    except Exception:
        return False
