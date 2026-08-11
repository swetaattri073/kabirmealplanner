#!/usr/bin/env python3
"""
Native-client workflow tests: guest + logged-in persistence via Bearer / X-Guest-Id.

Simulates the Expo app's API usage (no cookies required for returning).
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_TMP = tempfile.mkdtemp(prefix='lb-native-wf-')
os.environ['DATABASE_URL'] = f'sqlite:///{_TMP}/test.db'
os.environ['SECRET_KEY'] = 'native-workflow-secret-key'
os.environ.pop('FORCE_HTTPS', None)
os.environ['SESSION_COOKIE_SECURE'] = 'false'
os.environ['FLASK_ENV'] = 'testing'

from app import app, db  # noqa: E402
from models import Toddler, User  # noqa: E402


def client():
    app.config['TESTING'] = True
    return app.test_client()


class NativeWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with app.app_context():
            db.create_all()

    def setUp(self):
        self.c = client()

    def test_01_guest_status_returns_guest_id(self):
        r = self.c.get('/api/auth/status')
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertFalse(data['authenticated'])
        self.assertTrue(data.get('guest_id'))
        self.guest_id = data['guest_id']

    def test_02_guest_persists_across_new_client_with_header(self):
        # First request — create guest + toddler
        s1 = self.c.get('/api/auth/status').get_json()
        guest = s1['guest_id']
        create = self.c.post(
            '/api/toddlers',
            json={'name': 'TempKid', 'age_months': 16, 'dietary_preference': 'vegetarian'},
            headers={'X-Guest-Id': guest},
        )
        self.assertEqual(create.status_code, 201, create.get_data(as_text=True))
        body = create.get_json()
        self.assertEqual(body['name'], 'TempKid')
        # Returned guest_id should match
        if body.get('guest_id'):
            self.assertEqual(body['guest_id'], guest)

        # Brand-new client (no cookies) — only X-Guest-Id, like app relaunch
        c2 = client()
        listed = c2.get('/api/toddlers', headers={'X-Guest-Id': guest})
        self.assertEqual(listed.status_code, 200)
        kids = listed.get_json()
        self.assertEqual(len(kids), 1)
        self.assertEqual(kids[0]['name'], 'TempKid')

        restore = c2.post('/api/auth/restore', json={'guest_id': guest})
        self.assertEqual(restore.status_code, 200)
        restored = restore.get_json()
        self.assertTrue(restored.get('restored') or restored.get('toddlers'))
        self.assertEqual(restored['toddlers'][0]['name'], 'TempKid')

        dash = c2.get(
            f"/api/dashboard/{kids[0]['ref']}",
            headers={'X-Guest-Id': guest},
        )
        self.assertEqual(dash.status_code, 200)
        self.assertEqual(dash.get_json()['toddler']['name'], 'TempKid')

    def test_03_signup_returns_token_and_survives_relaunch(self):
        guest_status = self.c.get('/api/auth/status').get_json()
        guest = guest_status['guest_id']
        self.c.post(
            '/api/toddlers',
            json={'name': 'BeforeSignup', 'age_months': 14},
            headers={'X-Guest-Id': guest},
        )
        signup = self.c.post(
            '/api/auth/signup',
            json={
                'email': 'persist@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
                'name': 'Persist Parent',
                'guest_id': guest,
            },
            headers={'X-Guest-Id': guest},
        )
        self.assertEqual(signup.status_code, 201, signup.get_data(as_text=True))
        data = signup.get_json()
        token = data['token']
        self.assertTrue(token)
        self.assertGreaterEqual(data.get('transferred_toddlers', 0), 1)

        # New client — Bearer only (no cookies), like SecureStore relaunch
        c2 = client()
        status = c2.get('/api/auth/status', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(status.status_code, 200)
        body = status.get_json()
        self.assertTrue(body['authenticated'])
        self.assertEqual(body['user']['email'], 'persist@example.com')
        names = [t['name'] for t in body['toddlers']]
        self.assertIn('BeforeSignup', names)

        # Still authenticated on second call with same stored token
        status2 = c2.get('/api/auth/status', headers={'Authorization': f'Bearer {token}'})
        self.assertTrue(status2.get_json()['authenticated'])

    def test_04_login_token_persists_without_reprompt(self):
        self.c.post(
            '/api/auth/signup',
            json={
                'email': 'login@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
            },
        )
        # Fresh client login
        c2 = client()
        login = c2.post(
            '/api/auth/login',
            json={'email': 'login@example.com', 'password': 'password123'},
        )
        self.assertEqual(login.status_code, 200)
        token = login.get_json()['token']

        c3 = client()  # app killed and reopened
        st = c3.get('/api/auth/status', headers={'Authorization': f'Bearer {token}'})
        self.assertTrue(st.get_json()['authenticated'])
        # Must NOT be anonymous
        self.assertIsNone(st.get_json().get('guest_id'))

    def test_05_meal_log_plan_nutrition_recipes_chat_health(self):
        signup = self.c.post(
            '/api/auth/signup',
            json={
                'email': 'flows@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
            },
        )
        token = signup.get_json()['token']
        h = {'Authorization': f'Bearer {token}'}
        toddler = self.c.post(
            '/api/toddlers',
            json={'name': 'FlowKid', 'age_months': 18, 'dietary_preference': 'vegetarian'},
            headers=h,
        ).get_json()
        ref = toddler['ref']

        foods = self.c.get('/api/foods?search=dal', headers=h)
        self.assertEqual(foods.status_code, 200)
        food_list = foods.get_json()
        self.assertTrue(len(food_list) >= 1)
        food_id = food_list[0]['id']

        log = self.c.post(
            '/api/meal-logs',
            json={
                'toddler_id': ref,
                'meal_type': 'breakfast',
                'food_id': food_id,
                'toddler_reaction': 'liked',
                'portion_eaten_percent': 100,
                'replace_existing': True,
            },
            headers=h,
        )
        self.assertIn(log.status_code, (200, 201), log.get_data(as_text=True))

        dash = self.c.get(f'/api/dashboard/{ref}', headers=h)
        self.assertEqual(dash.status_code, 200)
        self.assertIn('breakfast', dash.get_json().get('meals_eaten', []))

        plan = self.c.get(f'/api/meal-plan/weekly/{ref}', headers=h)
        self.assertEqual(plan.status_code, 200)
        self.assertTrue(plan.get_json().get('days'))

        nutri = self.c.get(f'/api/nutrition/daily/{ref}', headers=h)
        self.assertEqual(nutri.status_code, 200)

        prefs = self.c.get(f'/api/preferences/{ref}', headers=h)
        self.assertEqual(prefs.status_code, 200)

        recipes = self.c.get('/api/recipes', headers=h)
        self.assertEqual(recipes.status_code, 200)

        # Chat may be feature-flagged; accept 200 or graceful deny
        chat = self.c.post(
            '/api/chat',
            json={'message': 'Suggest an iron-rich dinner', 'toddler_id': ref},
            headers=h,
        )
        self.assertIn(chat.status_code, (200, 403, 503))

    def test_06_logout_clears_session_but_token_invalid_only_by_client_discard(self):
        """Native logout: client discards token; server logout ok."""
        signup = self.c.post(
            '/api/auth/signup',
            json={
                'email': 'out@example.com',
                'password': 'password123',
                'confirm_password': 'password123',
            },
        )
        token = signup.get_json()['token']
        out = self.c.post('/api/auth/logout', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(out.status_code, 200)
        # Token still cryptographically valid until client deletes it (by design,
        # matching long-lived remember). Client must clear SecureStore — verified
        # in UI tests. Server status without Authorization is anonymous:
        st = self.c.get('/api/auth/status')
        self.assertFalse(st.get_json()['authenticated'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
