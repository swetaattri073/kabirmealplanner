/**
 * Persist guest identity across mobile / PWA cookie loss.
 *
 * Guest toddlers are keyed by anonymous_session_id on the server. When the
 * Flask session cookie disappears, we still have this token in localStorage
 * and can call /api/auth/restore to get the profile back.
 */
(function (global) {
  const GUEST_KEY = 'littlebowl_guest_id';
  const TODDLER_KEY = 'littlebowl_last_toddler_id';

  function readGuestId() {
    try {
      return (localStorage.getItem(GUEST_KEY) || '').trim() || null;
    } catch (e) {
      return null;
    }
  }

  function writeGuestId(id) {
    if (!id) return;
    try {
      localStorage.setItem(GUEST_KEY, String(id));
    } catch (e) { /* private mode */ }
  }

  function rememberToddler(id) {
    if (!id) return;
    try {
      localStorage.setItem(TODDLER_KEY, String(id));
    } catch (e) { /* ignore */ }
  }

  function lastToddlerId() {
    try {
      return localStorage.getItem(TODDLER_KEY);
    } catch (e) {
      return null;
    }
  }

  async function restore() {
    const guestId = readGuestId();
    const res = await fetch('/api/auth/restore', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ guest_id: guestId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.guest_id) {
      writeGuestId(data.guest_id);
    }
    if (data.toddlers && data.toddlers[0] && data.toddlers[0].id) {
      rememberToddler(data.toddlers[0].id);
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
      if (data.guest_id) writeGuestId(data.guest_id);
      if (data.toddlers && data.toddlers[0] && data.toddlers[0].id) {
        rememberToddler(data.toddlers[0].id);
      }
      return data;
    } catch (e) {
      return null;
    }
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
  };
})(window);
