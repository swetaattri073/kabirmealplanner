#!/usr/bin/env python3
"""
Full user-workflow regression for LittleBowl (local Flask).

Covers: marketing landing, register, login, guest onboarding, session restore,
dashboard access, logout, preferences/notifications pages, FORCE_HTTPS redirect,
Secure cookie flags when HTTPS is forced.
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Isolated DB + secrets before importing app
_TMP = tempfile.mkdtemp(prefix='lb-wf-')
os.environ['DATABASE_URL'] = f'sqlite:///{_TMP}/test.db'
os.environ['SECRET_KEY'] = 'workflow-test-secret-key-not-for-prod'
os.environ.pop('FORCE_HTTPS', None)
os.environ['SESSION_COOKIE_SECURE'] = 'false'
os.environ['FLASK_ENV'] = 'testing'

from app import app, db  # noqa: E402
from models import User, Toddler  # noqa: E402


def _client():
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    return app.test_client()


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with app.app_context():
            db.create_all()

    def setUp(self):
        self.c = _client()
        app.config['FORCE_HTTPS'] = False
        app.config['SESSION_COOKIE_SECURE'] = False
        app.config['REMEMBER_COOKIE_SECURE'] = False

    # --- Marketing / first open ---
    def test_01_landing_is_horizontal_stories(self):
        r = self.c.get('/')
        self.assertEqual(r.status_code, 200)
        html = r.get_data(as_text=True)
        self.assertIn('story-track', html)
        self.assertIn('data-slide="register"', html)
        self.assertIn('native-first-ctas', html)
        self.assertIn('Create account', html)
        self.assertIn('Sign in', html)

    def test_02_home_bridge_for_anonymous(self):
        r = self.c.get('/home')
        # No toddlers → bridge HTML (JS sends to /)
        self.assertEqual(r.status_code, 200)
        self.assertIn('Opening LittleBowl', r.get_data(as_text=True))
        self.assertIn('session-persist.js', r.get_data(as_text=True))

    # --- Guest workflow ---
    def test_03_guest_create_toddler_and_dashboard(self):
        r = self.c.post(
            '/api/toddlers',
            json={
                'name': 'GuestAarav',
                'age_months': 20,
                'gender': 'male',
                'dietary_preference': 'vegetarian',
                'activity_level': 'moderate',
            },
        )
        self.assertIn(r.status_code, (200, 201), r.get_data(as_text=True))
        data = r.get_json()
        tid = data.get('ref') or data.get('id')
        self.assertTrue(tid)
        dash = self.c.get(f'/dashboard/{tid}')
        self.assertEqual(dash.status_code, 200)
        self.assertIn('GuestAarav', dash.get_data(as_text=True))
        # Session restored via cookies the client stores automatically
        status = self.c.get('/api/auth/status').get_json()
        self.assertTrue(any(t.get('name') == 'GuestAarav' for t in status.get('toddlers') or []))

    def test_04_auth_restore_returns_guest_toddlers(self):
        # Create guest toddler in this client session
        r = self.c.post(
            '/api/toddlers',
            json={'name': 'RestoreMe', 'age_months': 18, 'gender': 'female',
                  'dietary_preference': 'vegetarian', 'activity_level': 'moderate'},
        )
        self.assertIn(r.status_code, (200, 201))
        guest = r.get_json().get('guest_id')
        status = self.c.get('/api/auth/status')
        self.assertEqual(status.status_code, 200)
        body = status.get_json()
        self.assertFalse(body.get('authenticated'))
        self.assertTrue(body.get('toddlers'))
        restore = self.c.post('/api/auth/restore', json={'guest_id': guest or body.get('guest_id')})
        self.assertEqual(restore.status_code, 200)
        self.assertTrue(restore.get_json().get('toddlers'))

    # --- Register + login ---
    def test_05_register_login_logout_restore(self):
        email = f'wf_{int(time.time())}@example.com'
        password = 'WorkflowPass123!'
        # Signup via form
        r = self.c.post(
            '/signup',
            data={
                'name': 'Workflow Parent',
                'email': email,
                'password': password,
                'confirm_password': password,
                'next': 'landing',
            },
            follow_redirects=False,
        )
        self.assertIn(r.status_code, (302, 303))
        # Should be authenticated
        st = self.c.get('/api/auth/status').get_json()
        self.assertTrue(st.get('authenticated'), st)
        self.assertEqual(st['user']['email'], email)

        # Create toddler for account
        r = self.c.post(
            '/api/toddlers',
            json={'name': 'KabirWF', 'age_months': 16, 'gender': 'male',
                  'dietary_preference': 'vegetarian', 'activity_level': 'moderate'},
        )
        self.assertIn(r.status_code, (200, 201), r.get_data(as_text=True))
        ref = r.get_json().get('ref') or r.get_json().get('id')

        # Home should redirect to dashboard
        home = self.c.get('/home', follow_redirects=False)
        self.assertIn(home.status_code, (302, 303))
        self.assertIn('/dashboard/', home.headers.get('Location', ''))

        # Profile + notification mount
        prof = self.c.get('/profile')
        self.assertEqual(prof.status_code, 200)
        self.assertIn('notification-settings', prof.get_data(as_text=True))
        self.assertIn('Meal reminders', prof.get_data(as_text=True))

        # Preferences page also has reminder settings
        prefs = self.c.get(f'/preferences/{ref}')
        self.assertEqual(prefs.status_code, 200)
        html = prefs.get_data(as_text=True)
        self.assertIn('notification-settings', html)
        self.assertIn('Meal log reminders', html)

        # Logout
        out = self.c.get('/logout', follow_redirects=False)
        self.assertIn(out.status_code, (302, 303))
        loc = out.headers.get('Location', '')
        self.assertTrue(loc.endswith('/') or 'signed_out=1' in loc or loc.endswith('/?signed_out=1') or 'signed_out' in loc)
        st2 = self.c.get('/api/auth/status').get_json()
        self.assertFalse(st2.get('authenticated'))

        # Login again
        login = self.c.post(
            '/login',
            data={'email': email, 'password': password, 'remember': '1'},
            follow_redirects=False,
        )
        self.assertIn(login.status_code, (302, 303))
        st3 = self.c.get('/api/auth/status').get_json()
        self.assertTrue(st3.get('authenticated'))
        self.assertTrue(st3.get('toddlers'))

    def test_06_login_page_has_session_persist(self):
        r = self.c.get('/login')
        self.assertEqual(r.status_code, 200)
        self.assertIn('session-persist.js', r.get_data(as_text=True))

    def test_07_onboarding_page_for_new_user(self):
        r = self.c.get('/onboarding')
        self.assertEqual(r.status_code, 200)
        self.assertIn('Start Planning', r.get_data(as_text=True))

    # --- HTTPS / cookies ---
    def test_08_force_https_redirect(self):
        app.config['FORCE_HTTPS'] = True
        r = self.c.get('/', base_url='http://littlebowl.in', follow_redirects=False)
        self.assertEqual(r.status_code, 301)
        self.assertTrue(r.headers['Location'].startswith('https://littlebowl.in'))
        # localhost exempt for healthchecks
        r2 = self.c.get('/', base_url='http://127.0.0.1:5000', follow_redirects=False)
        self.assertEqual(r2.status_code, 200)

    def test_09_secure_cookies_when_forced(self):
        app.config['FORCE_HTTPS'] = True
        app.config['SESSION_COOKIE_SECURE'] = True
        app.config['REMEMBER_COOKIE_SECURE'] = True
        # Simulate HTTPS via environ
        r = self.c.get(
            '/',
            base_url='https://littlebowl.in',
            environ_overrides={'wsgi.url_scheme': 'https'},
        )
        self.assertEqual(r.status_code, 200)
        # Creating a guest session should set Secure guest cookie
        r2 = self.c.post(
            '/api/toddlers',
            json={'name': 'SecureKid', 'age_months': 12, 'gender': 'male',
                  'dietary_preference': 'vegetarian', 'activity_level': 'moderate'},
            base_url='https://littlebowl.in',
            environ_overrides={'wsgi.url_scheme': 'https'},
        )
        self.assertIn(r2.status_code, (200, 201))
        # Inspect Set-Cookie headers
        raw = r2.headers.getlist('Set-Cookie') if hasattr(r2.headers, 'getlist') else []
        if not raw:
            # Werkzeug 3 may expose differently
            raw = [v for k, v in r2.headers.items() if k.lower() == 'set-cookie']
        joined = ' '.join(raw)
        if 'lb_guest_id' in joined or 'lb_session' in joined:
            self.assertIn('Secure', joined)

    def test_10_transfer_guest_to_account_on_signup(self):
        # Guest toddler first
        g = self.c.post(
            '/api/toddlers',
            json={'name': 'TransferTot', 'age_months': 22, 'gender': 'female',
                  'dietary_preference': 'vegetarian', 'activity_level': 'moderate'},
        )
        self.assertIn(g.status_code, (200, 201))
        email = f'transfer_{int(time.time())}@example.com'
        r = self.c.post(
            '/signup',
            data={
                'name': 'Transfer Parent',
                'email': email,
                'password': 'TransferPass123!',
                'confirm_password': 'TransferPass123!',
            },
            follow_redirects=False,
        )
        self.assertIn(r.status_code, (302, 303))
        st = self.c.get('/api/auth/status').get_json()
        self.assertTrue(st.get('authenticated'))
        names = [t.get('name') for t in st.get('toddlers') or []]
        self.assertIn('TransferTot', names)

    def test_11_static_session_and_notifications_js(self):
        for path in ('/static/js/session-persist.js', '/static/js/notifications.js'):
            r = self.c.get(path)
            self.assertEqual(r.status_code, 200, path)
        sess = self.c.get('/static/js/session-persist.js').get_data(as_text=True)
        self.assertIn('resolveDashboardPath', sess)
        self.assertIn('Preferences', sess)
        notify = self.c.get('/static/js/notifications.js').get_data(as_text=True)
        self.assertIn('mealReminders', notify)
        self.assertTrue(
            'notify-times' in notify or 'DEFAULT_TIMES' in notify or 'Reminder times' in notify
        )

    def test_12_capacitor_points_https(self):
        cfg = (ROOT / 'android-app' / 'capacitor.config.json').read_text()
        self.assertIn('https://littlebowl.in/home', cfg)
        self.assertIn('"cleartext": false', cfg)
        plist = (ROOT / 'android-app' / 'ios' / 'App' / 'App' / 'Info.plist').read_text()
        self.assertNotIn('NSExceptionAllowsInsecureHTTPLoads', plist)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(WorkflowTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
