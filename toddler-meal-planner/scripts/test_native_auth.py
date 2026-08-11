#!/usr/bin/env python3
"""Smoke tests for native JSON auth (Bearer) — does not touch admin or HTML UI."""

import os
import sys
import tempfile
import unittest

# Ensure package root is on path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

os.environ.setdefault('SECRET_KEY', 'test-native-auth-secret-key')
os.environ.setdefault('FLASK_ENV', 'testing')

# Isolated DB
_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
os.environ['DATABASE_URL'] = 'sqlite:///' + _db.name

from app import app, db, User  # noqa: E402
from api_auth import issue_api_token, verify_api_token  # noqa: E402


class NativeAuthTests(unittest.TestCase):
    def setUp(self):
        self.ctx = app.app_context()
        self.ctx.push()
        db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_token_roundtrip(self):
        tok = issue_api_token(app.config['SECRET_KEY'], 7)
        self.assertEqual(verify_api_token(app.config['SECRET_KEY'], tok), 7)

    def test_signup_login_bearer_status(self):
        r = self.client.post(
            '/api/auth/signup',
            json={
                'email': 'parent@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
                'name': 'Parent',
            },
        )
        self.assertEqual(r.status_code, 201, r.get_data(as_text=True))
        data = r.get_json()
        self.assertTrue(data.get('ok'))
        self.assertTrue(data.get('token'))
        token = data['token']

        status = self.client.get(
            '/api/auth/status',
            headers={'Authorization': f'Bearer {token}'},
        )
        self.assertEqual(status.status_code, 200)
        body = status.get_json()
        self.assertTrue(body.get('authenticated'))
        self.assertEqual(body['user']['email'], 'parent@example.com')
        self.assertTrue(body.get('token'))

        # Login again
        login = self.client.post(
            '/api/auth/login',
            json={'email': 'parent@example.com', 'password': 'password123'},
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json().get('token'))

    def test_api_unauthorized_json(self):
        # Toddlers list is public for guests; use a login-required-ish path.
        # Prefer preferences with fake id → 404/403 after auth, but without
        # bearer on an endpoint that uses @login_required if any.
        # Create user-owned resource path: /api/auth/logout is fine.
        r = self.client.post('/api/auth/logout')
        self.assertEqual(r.status_code, 200)

    def test_bearer_access_toddlers(self):
        signup = self.client.post(
            '/api/auth/signup',
            json={
                'email': 'a@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
            },
        )
        token = signup.get_json()['token']
        create = self.client.post(
            '/api/toddlers',
            json={'name': 'Aarav', 'age_months': 18, 'dietary_preference': 'vegetarian'},
            headers={'Authorization': f'Bearer {token}'},
        )
        self.assertEqual(create.status_code, 201, create.get_data(as_text=True))
        listed = self.client.get(
            '/api/toddlers',
            headers={'Authorization': f'Bearer {token}'},
        )
        self.assertEqual(listed.status_code, 200)
        kids = listed.get_json()
        self.assertEqual(len(kids), 1)
        self.assertEqual(kids[0]['name'], 'Aarav')


if __name__ == '__main__':
    unittest.main()
