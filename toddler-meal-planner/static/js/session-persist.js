/**
 * Persist identity across mobile / PWA cookie loss + native app restarts.
 *
 * Stores guest id, last toddler, and auth snapshot in localStorage and
 * (when available) Capacitor Preferences so the next app open can skip
 * marketing and open the dashboard directly.
 */
(function (global) {
  const GUEST_KEY = 'littlebowl_guest_id';
  const TODDLER_KEY = 'littlebowl_last_toddler_id';
  const AUTH_KEY = 'littlebowl_auth_v1';
  const DASH_KEY = 'littlebowl_dashboard_path';

  function prefsPlugin() {
    try {
      return global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Preferences
        ? Capacitor.Plugins.Preferences
        : null;
    } catch (e) {
      return null;
    }
  }

  async function deviceSet(key, value) {
    const v = value == null ? '' : String(value);
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch (e) { /* private mode */ }
    const P = prefsPlugin();
    if (!P) return;
    try {
      if (v) await P.set({ key, value: v });
      else await P.remove({ key });
    } catch (e) { /* ignore */ }
  }

  async function deviceGet(key) {
    const P = prefsPlugin();
    if (P) {
      try {
        const r = await P.get({ key });
        if (r && r.value) return r.value;
      } catch (e) { /* fall through */ }
    }
    try {
      return (localStorage.getItem(key) || '').trim() || null;
    } catch (e) {
      return null;
    }
  }

  function readGuestId() {
    try {
      return (localStorage.getItem(GUEST_KEY) || '').trim() || null;
    } catch (e) {
      return null;
    }
  }

  function writeGuestId(id) {
    if (!id) return;
    deviceSet(GUEST_KEY, id);
    try {
      localStorage.setItem(GUEST_KEY, String(id));
    } catch (e) { /* private mode */ }
  }

  function rememberToddler(id) {
    if (!id) return;
    const ref = String(id);
    deviceSet(TODDLER_KEY, ref);
    deviceSet(DASH_KEY, '/dashboard/' + ref);
    try {
      localStorage.setItem(TODDLER_KEY, ref);
      localStorage.setItem(DASH_KEY, '/dashboard/' + ref);
    } catch (e) { /* ignore */ }
  }

  function lastToddlerId() {
    try {
      return localStorage.getItem(TODDLER_KEY);
    } catch (e) {
      return null;
    }
  }

  function rememberAuth(user) {
    const payload = JSON.stringify({
      authenticated: true,
      user: user || null,
      at: Date.now(),
    });
    deviceSet(AUTH_KEY, payload);
    try {
      localStorage.setItem(AUTH_KEY, payload);
    } catch (e) { /* ignore */ }
  }

  function clearAuth() {
    deviceSet(AUTH_KEY, '');
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* ignore */ }
  }

  function readAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  async function rememberFromStatus(data) {
    if (!data) return data;
    if (data.guest_id) writeGuestId(data.guest_id);
    const toddlers = data.toddlers || [];
    if (toddlers[0]) {
      const id = toddlers[0].ref || toddlers[0].id;
      rememberToddler(id);
    }
    if (data.authenticated && data.user) {
      rememberAuth(data.user);
    } else if (data.authenticated === false) {
      // Keep cached auth only if server still has a session cookie elsewhere;
      // clear when status explicitly says anonymous with no toddlers transferred.
      if (!toddlers.length) {
        /* leave guest keys; only clear auth marker if clearly logged out */
      }
    }
    return data;
  }

  async function restore() {
    let guestId = readGuestId();
    if (!guestId) {
      guestId = await deviceGet(GUEST_KEY);
      if (guestId) writeGuestId(guestId);
    }
    const res = await fetch('/api/auth/restore', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ guest_id: guestId }),
    });
    const data = await res.json().catch(() => ({}));
    await rememberFromStatus(data);
    if (data.authenticated && data.user) {
      rememberAuth(data.user);
    }
    return data;
  }

  async function syncFromStatus() {
    try {
      const res = await fetch('/api/auth/status', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      await rememberFromStatus(data);
      if (data.authenticated && data.user) {
        rememberAuth(data.user);
      } else if (data.authenticated === false) {
        clearAuth();
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  async function clearLocalSession() {
    await deviceSet(GUEST_KEY, '');
    await deviceSet(TODDLER_KEY, '');
    await deviceSet(DASH_KEY, '');
    await deviceSet(AUTH_KEY, '');
    try {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(TODDLER_KEY);
      localStorage.removeItem(DASH_KEY);
      localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* ignore */ }
  }

  async function resolveDashboardPath() {
    const data = await restore();
    const toddlers = (data && data.toddlers) || [];
    if (toddlers.length) {
      const id = toddlers[0].ref || toddlers[0].id;
      rememberToddler(id);
      return { path: '/dashboard/' + id, authenticated: !!data.authenticated, toddlers, data };
    }
    if (data && data.authenticated) {
      return { path: '/onboarding', authenticated: true, toddlers: [], data };
    }
    return { path: '/', authenticated: false, toddlers: [], data };
  }

  // Keep localStorage in sync whenever we are inside the app shell.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { syncFromStatus(); });
  } else {
    syncFromStatus();
  }

  global.LittleBowlSession = {
    restore,
    syncFromStatus,
    writeGuestId,
    readGuestId,
    rememberToddler,
    lastToddlerId,
    rememberAuth,
    clearAuth,
    clearLocalSession,
    readAuth,
    resolveDashboardPath,
    deviceGet,
    deviceSet,
  };
})(window);
