/**
 * LittleBowl notifications — meal log reminders + nutrition alerts.
 *
 * Defaults: notifications ON (meal reminders + nutrition alerts).
 * Native (Android + iOS): Capacitor Local Notifications.
 * Web/PWA: Notification API fallback.
 */
(function (global) {
  const PREF_KEY = 'littlebowl_notify_prefs_v2';
  const ALERT_SEEN_KEY = 'littlebowl_alert_notified_v1';
  const BOOTSTRAP_KEY = 'littlebowl_notify_bootstrapped_v2';

  const DEFAULT_TIMES = {
    breakfast: '08:00',
    mid_morning_snack: '10:30',
    lunch: '12:30',
    evening_snack: '16:00',
    dinner: '19:00',
  };

  const MEAL_LABELS = {
    breakfast: 'Breakfast',
    mid_morning_snack: 'Mid-morning snack',
    lunch: 'Lunch',
    evening_snack: 'Evening snack',
    dinner: 'Dinner',
  };

  const MEAL_ID_BASE = 1100;
  const MEAL_ORDER = [
    'breakfast',
    'mid_morning_snack',
    'lunch',
    'evening_snack',
    'dinner',
  ];
  const ALERT_ID_BASE = 2100;

  function defaultPrefs() {
    return {
      enabled: true,
      mealReminders: true,
      nutritionAlerts: true,
      times: { ...DEFAULT_TIMES },
      toddlerRef: null,
      toddlerName: null,
    };
  }

  function migrateLegacyPrefs() {
    try {
      if (localStorage.getItem(PREF_KEY)) return;
      const legacy = localStorage.getItem('littlebowl_notify_prefs_v1');
      if (!legacy) return;
      const parsed = JSON.parse(legacy);
      // Preserve explicit user choices; if they never set anything useful, keep defaults ON
      const merged = {
        ...defaultPrefs(),
        ...parsed,
        times: { ...DEFAULT_TIMES, ...(parsed.times || {}) },
      };
      if (parsed.enabled == null) merged.enabled = true;
      if (parsed.mealReminders == null) merged.mealReminders = true;
      if (parsed.nutritionAlerts == null) merged.nutritionAlerts = true;
      localStorage.setItem(PREF_KEY, JSON.stringify(merged));
    } catch (e) { /* ignore */ }
  }

  function loadPrefs() {
    migrateLegacyPrefs();
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) {
        const defaults = defaultPrefs();
        localStorage.setItem(PREF_KEY, JSON.stringify(defaults));
        return defaults;
      }
      const parsed = JSON.parse(raw);
      return {
        ...defaultPrefs(),
        ...parsed,
        times: { ...DEFAULT_TIMES, ...(parsed.times || {}) },
      };
    } catch (e) {
      return defaultPrefs();
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  function isNative() {
    try {
      return !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function getLocalNotifications() {
    if (isNative() && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
      return Capacitor.Plugins.LocalNotifications;
    }
    return null;
  }

  function parseTime(hhmm) {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return { hour, minute };
  }

  function mealId(mealType) {
    const idx = MEAL_ORDER.indexOf(mealType);
    return MEAL_ID_BASE + (idx >= 0 ? idx : 9);
  }

  function hashToId(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return ALERT_ID_BASE + (Math.abs(h) % 700);
  }

  async function checkPermissionState() {
    const LN = getLocalNotifications();
    if (LN) {
      try {
        const status = await LN.checkPermissions();
        return status.display || 'prompt';
      } catch (e) {
        return 'prompt';
      }
    }
    if (!('Notification' in global)) return 'unsupported';
    return Notification.permission; // granted | denied | default
  }

  async function ensurePermissions() {
    const LN = getLocalNotifications();
    if (LN) {
      let status = await LN.checkPermissions();
      if (status.display !== 'granted') {
        status = await LN.requestPermissions();
      }
      return status.display === 'granted';
    }
    if (!('Notification' in global)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async function cancelMealReminders() {
    const LN = getLocalNotifications();
    if (!LN) return;
    const ids = MEAL_ORDER.map((m) => ({ id: mealId(m) }));
    try {
      await LN.cancel({ notifications: ids });
    } catch (e) {
      console.warn('cancelMealReminders', e);
    }
  }

  async function ensureChannels(LN) {
    if (!LN || typeof LN.createChannel !== 'function') return;
    try {
      await LN.createChannel({
        id: 'meal-reminders',
        name: 'Meal reminders',
        description: 'Reminders to log breakfast, lunch, dinner, and snacks',
        importance: 4,
        visibility: 1,
        sound: 'default',
      });
    } catch (e) { /* already exists */ }
    try {
      await LN.createChannel({
        id: 'nutrition-alerts',
        name: 'Nutrition alerts',
        description: 'Warnings when key nutrients look low',
        importance: 5,
        visibility: 1,
        sound: 'default',
      });
    } catch (e) { /* already exists */ }
  }

  async function scheduleMealReminders(prefs) {
    await cancelMealReminders();
    if (!prefs.enabled || !prefs.mealReminders) return { scheduled: 0 };

    const granted = await ensurePermissions();
    if (!granted) return { scheduled: 0, permissionDenied: true };

    const LN = getLocalNotifications();
    const name = prefs.toddlerName || 'your toddler';
    const notifications = [];

    MEAL_ORDER.forEach((mealType) => {
      const t = parseTime(prefs.times[mealType]);
      if (!t) return;
      const label = MEAL_LABELS[mealType] || mealType;
      notifications.push({
        id: mealId(mealType),
        title: `Time to log ${label}`,
        body: `Has ${name} eaten ${label.toLowerCase()}? Tap to log the meal.`,
        schedule: {
          on: { hour: t.hour, minute: t.minute },
          repeats: true,
          allowWhileIdle: true,
        },
        sound: 'default',
        channelId: 'meal-reminders',
        smallIcon: 'ic_stat_littlebowl',
        extra: {
          type: 'meal_reminder',
          mealType,
          toddlerRef: prefs.toddlerRef,
        },
      });
    });

    if (!notifications.length) return { scheduled: 0 };

    if (LN) {
      await ensureChannels(LN);
      await LN.schedule({ notifications });
      return { scheduled: notifications.length };
    }

    maybeWebMealNudge(prefs);
    return { scheduled: 0, webFallback: true };
  }

  function minutesNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function maybeWebMealNudge(prefs) {
    if (!('Notification' in global) || Notification.permission !== 'granted') return;
    const now = minutesNow();
    MEAL_ORDER.forEach((mealType) => {
      const t = parseTime(prefs.times[mealType]);
      if (!t) return;
      const target = t.hour * 60 + t.minute;
      if (now < target || now > target + 5) return;
      const dayKey = `web_nudge_${mealType}_${new Date().toISOString().slice(0, 10)}`;
      if (sessionStorage.getItem(dayKey)) return;
      sessionStorage.setItem(dayKey, '1');
      const label = MEAL_LABELS[mealType] || mealType;
      try {
        new Notification(`Time to log ${label}`, {
          body: `Has ${prefs.toddlerName || 'your toddler'} eaten? Open LittleBowl to log it.`,
          tag: `meal-${mealType}`,
        });
      } catch (e) { /* ignore */ }
    });
  }

  function loadAlertSeen() {
    try {
      return JSON.parse(localStorage.getItem(ALERT_SEEN_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveAlertSeen(map) {
    localStorage.setItem(ALERT_SEEN_KEY, JSON.stringify(map));
  }

  function alertFingerprint(alert) {
    return [
      alert.type || '',
      alert.nutrient || '',
      alert.severity || '',
      (alert.message || '').slice(0, 80),
    ].join('|');
  }

  async function notifyNutritionAlerts(alerts, prefs) {
    if (!prefs.enabled || !prefs.nutritionAlerts) return { sent: 0 };
    if (!alerts || !alerts.length) return { sent: 0 };

    const actionable = alerts.filter((a) =>
      a && (a.severity === 'critical' || a.severity === 'warning')
    );
    if (!actionable.length) return { sent: 0 };

    const granted = await ensurePermissions();
    if (!granted) return { sent: 0, permissionDenied: true };

    const seen = loadAlertSeen();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const LN = getLocalNotifications();
    const toSchedule = [];

    for (const alert of actionable) {
      const fp = alertFingerprint(alert);
      const last = seen[fp] || 0;
      if (now - last < DAY) continue;
      seen[fp] = now;

      const title =
        alert.severity === 'critical'
          ? `Nutrition alert${alert.nutrient_name ? `: ${alert.nutrient_name}` : ''}`
          : `Nutrition tip${alert.nutrient_name ? `: ${alert.nutrient_name}` : ''}`;
      const body = alert.message || alert.recommendation || 'Open Nutrition for details.';
      const id = hashToId(fp);

      if (LN) {
        toSchedule.push({
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1500) },
          sound: 'default',
          channelId: 'nutrition-alerts',
          smallIcon: 'ic_stat_littlebowl',
          extra: {
            type: 'nutrition_alert',
            toddlerRef: prefs.toddlerRef,
            severity: alert.severity,
          },
        });
      } else if ('Notification' in global) {
        try {
          new Notification(title, { body, tag: `alert-${id}` });
          toSchedule.push({ id });
        } catch (e) { /* ignore */ }
      }
    }

    saveAlertSeen(seen);

    if (LN && toSchedule.length) {
      await ensureChannels(LN);
      await LN.schedule({ notifications: toSchedule });
    }
    return { sent: toSchedule.length };
  }

  function handleNotificationAction(notification) {
    const extra = (notification && notification.extra) || {};
    const ref = extra.toddlerRef || loadPrefs().toddlerRef;
    if (!ref) return;

    if (extra.type === 'meal_reminder' && extra.mealType) {
      global.location.href = `/log-meal/${ref}?meal=${encodeURIComponent(extra.mealType)}`;
      return;
    }
    if (extra.type === 'nutrition_alert') {
      global.location.href = `/nutrition/${ref}#alerts`;
    }
  }

  let listenersBound = false;
  function bindNativeListeners() {
    const LN = getLocalNotifications();
    if (!LN || listenersBound) return;
    listenersBound = true;
    try {
      LN.addListener('localNotificationActionPerformed', (event) => {
        handleNotificationAction(event.notification || {});
      });
      LN.addListener('localNotificationReceived', () => {});
    } catch (e) {
      console.warn('notification listeners', e);
    }
  }

  function updateDashboardBanner(state) {
    const host = document.getElementById('notify-dashboard-banner');
    if (!host) return;
    const prefs = loadPrefs();
    if (!prefs.enabled) {
      host.hidden = true;
      return;
    }
    if (state === 'granted') {
      host.hidden = true;
      return;
    }
    if (state === 'denied') {
      host.hidden = false;
      host.className = 'notify-banner notify-banner-warn';
      host.innerHTML = `
        <div class="notify-banner-icon"><i class="fas fa-bell-slash"></i></div>
        <div class="notify-banner-copy">
          <strong>Notifications are blocked</strong>
          <p>Enable them in system settings so meal reminders and nutrition alerts can reach you.</p>
        </div>
        <a class="btn btn-sm btn-outline" href="/profile#notifications">Settings</a>
      `;
      return;
    }
    // prompt / default
    host.hidden = false;
    host.className = 'notify-banner notify-banner-info';
    host.innerHTML = `
      <div class="notify-banner-icon"><i class="fas fa-bell"></i></div>
      <div class="notify-banner-copy">
        <strong>Meal reminders are on</strong>
        <p>Allow notifications so we can nudge you to log meals and flag nutrition gaps.</p>
      </div>
      <button type="button" class="btn btn-sm btn-primary" id="notify-banner-allow">Allow</button>
    `;
    host.querySelector('#notify-banner-allow')?.addEventListener('click', async () => {
      const ok = await ensurePermissions();
      updateDashboardBanner(ok ? 'granted' : await checkPermissionState());
      if (ok) {
        await scheduleMealReminders(loadPrefs());
        if (typeof showToast === 'function') showToast('Notifications enabled', 'success');
      }
    });
  }

  /**
   * Sync reminders + alerts from dashboard (or nutrition) payload.
   * Notifications are ON by default — first visit requests permission.
   */
  async function syncFromDashboard(data) {
    if (!data || !data.toddler) return;
    const prefs = loadPrefs();
    prefs.enabled = prefs.enabled !== false;
    prefs.mealReminders = prefs.mealReminders !== false;
    prefs.nutritionAlerts = prefs.nutritionAlerts !== false;
    prefs.toddlerRef = data.toddler.ref || data.toddler.id;
    prefs.toddlerName = data.toddler.name || prefs.toddlerName;
    savePrefs(prefs);

    bindNativeListeners();

    if (!prefs.enabled) {
      await cancelMealReminders();
      updateDashboardBanner('denied');
      return;
    }

    const schedule = data.toddler.meal_schedule || data.schedule || {};
    const slots = []
      .concat(schedule.meals || [])
      .concat(schedule.snacks || []);
    if (slots.length) {
      slots.forEach((slot) => {
        if (!prefs.times[slot] && DEFAULT_TIMES[slot]) {
          prefs.times[slot] = DEFAULT_TIMES[slot];
        }
      });
      savePrefs(prefs);
    }

    const perm = await checkPermissionState();
    updateDashboardBanner(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt');

    // First successful dashboard visit: actively request permission (defaults are ON)
    if (!localStorage.getItem(BOOTSTRAP_KEY) && perm !== 'denied') {
      localStorage.setItem(BOOTSTRAP_KEY, '1');
      await ensurePermissions();
      updateDashboardBanner(await checkPermissionState());
    }

    await scheduleMealReminders(prefs);
    await notifyNutritionAlerts(data.alerts || [], prefs);
  }

  async function enableAndSchedule(options = {}) {
    const prefs = loadPrefs();
    prefs.enabled = true;
    if (options.toddlerRef) prefs.toddlerRef = options.toddlerRef;
    if (options.toddlerName) prefs.toddlerName = options.toddlerName;
    if (options.mealReminders != null) prefs.mealReminders = !!options.mealReminders;
    if (options.nutritionAlerts != null) prefs.nutritionAlerts = !!options.nutritionAlerts;
    if (options.times) prefs.times = { ...prefs.times, ...options.times };
    savePrefs(prefs);

    const granted = await ensurePermissions();
    if (!granted) {
      return { ok: false, error: 'Notification permission was not granted.' };
    }
    bindNativeListeners();
    await scheduleMealReminders(prefs);
    return { ok: true, prefs };
  }

  async function disableAll() {
    const prefs = loadPrefs();
    prefs.enabled = false;
    savePrefs(prefs);
    await cancelMealReminders();
    return prefs;
  }

  async function saveSettingsFromForm(formPrefs) {
    const prefs = { ...loadPrefs(), ...formPrefs };
    prefs.times = { ...DEFAULT_TIMES, ...(formPrefs.times || prefs.times || {}) };
    savePrefs(prefs);
    if (!prefs.enabled) {
      await cancelMealReminders();
      return { ok: true, prefs };
    }
    const granted = await ensurePermissions();
    if (!granted) {
      return { ok: false, error: 'Allow notifications in system settings to enable reminders.', prefs };
    }
    bindNativeListeners();
    const result = await scheduleMealReminders(prefs);
    return { ok: true, prefs, scheduled: result.scheduled };
  }

  async function sendTestNotification() {
    const prefs = loadPrefs();
    const granted = await ensurePermissions();
    if (!granted) {
      return { ok: false, error: 'Notification permission is required for a test.' };
    }
    const LN = getLocalNotifications();
    const title = 'LittleBowl test';
    const body = prefs.mealReminders
      ? 'Reminders are working. You will get nudges at meal times.'
      : 'Notifications are working.';
    if (LN) {
      await ensureChannels(LN);
      await LN.schedule({
        notifications: [{
          id: 9999,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          channelId: 'meal-reminders',
          smallIcon: 'ic_stat_littlebowl',
          extra: { type: 'test', toddlerRef: prefs.toddlerRef },
        }],
      });
      return { ok: true };
    }
    if ('Notification' in global) {
      new Notification(title, { body, tag: 'littlebowl-test' });
      return { ok: true };
    }
    return { ok: false, error: 'Notifications are not supported in this browser.' };
  }

  function permissionBadgeHtml(state) {
    if (state === 'granted') {
      return '<span class="notify-badge notify-badge-on"><i class="fas fa-check-circle"></i> Allowed</span>';
    }
    if (state === 'denied') {
      return '<span class="notify-badge notify-badge-off"><i class="fas fa-times-circle"></i> Blocked</span>';
    }
    if (state === 'unsupported') {
      return '<span class="notify-badge notify-badge-off">Not supported</span>';
    }
    return '<span class="notify-badge notify-badge-pending"><i class="fas fa-clock"></i> Permission needed</span>';
  }

  async function renderSettings(container) {
    if (!container) return;
    const prefs = loadPrefs();
    const native = isNative();
    const perm = await checkPermissionState();

    container.innerHTML = `
      <div class="notify-settings">
        <div class="notify-hero">
          <div class="notify-hero-text">
            <p class="notify-lead">
              ${native
                ? 'Meal log reminders and nutrition alerts are <strong>on by default</strong> in the LittleBowl app.'
                : 'Meal log reminders and nutrition alerts are <strong>on by default</strong>. Allow browser notifications to receive them.'}
            </p>
          </div>
          ${permissionBadgeHtml(perm)}
        </div>

        <div class="notify-toggles">
          <label class="notify-toggle notify-toggle-card">
            <input type="checkbox" id="notify-enabled" ${prefs.enabled ? 'checked' : ''}>
            <span class="notify-toggle-copy">
              <strong>Notifications</strong>
              <small>Master switch for all LittleBowl alerts</small>
            </span>
          </label>
          <label class="notify-toggle notify-toggle-card">
            <input type="checkbox" id="notify-meals" ${prefs.mealReminders ? 'checked' : ''} ${prefs.enabled ? '' : 'disabled'}>
            <span class="notify-toggle-copy">
              <strong>Meal log reminders</strong>
              <small>Daily nudges at breakfast, snacks, lunch, and dinner</small>
            </span>
          </label>
          <label class="notify-toggle notify-toggle-card">
            <input type="checkbox" id="notify-alerts" ${prefs.nutritionAlerts ? 'checked' : ''} ${prefs.enabled ? '' : 'disabled'}>
            <span class="notify-toggle-copy">
              <strong>Nutrition alerts</strong>
              <small>Warn when iron, protein, or other nutrients look low</small>
            </span>
          </label>
        </div>

        <div class="notify-times" id="notify-times">
          <div class="notify-times-head">
            <h4>Reminder times</h4>
            <span class="notify-times-hint">Local device time</span>
          </div>
          <div class="notify-time-grid">
            ${MEAL_ORDER.map((meal) => `
              <label class="notify-time-row">
                <span>${MEAL_LABELS[meal]}</span>
                <input type="time" data-meal="${meal}" value="${prefs.times[meal] || DEFAULT_TIMES[meal]}">
              </label>
            `).join('')}
          </div>
        </div>

        <div class="notify-actions">
          <button type="button" class="btn btn-primary" id="notify-save">
            <i class="fas fa-bell"></i> Save settings
          </button>
          <button type="button" class="btn btn-outline" id="notify-test">
            <i class="fas fa-vial"></i> Send test
          </button>
        </div>
        <p class="notify-status" id="notify-status" hidden></p>
      </div>
    `;

    const enabledEl = container.querySelector('#notify-enabled');
    const mealsEl = container.querySelector('#notify-meals');
    const alertsEl = container.querySelector('#notify-alerts');
    const timesWrap = container.querySelector('#notify-times');
    const statusEl = container.querySelector('#notify-status');

    function refreshDisabled() {
      const on = enabledEl.checked;
      mealsEl.disabled = !on;
      alertsEl.disabled = !on;
      const showTimes = on && mealsEl.checked;
      timesWrap.classList.toggle('is-disabled', !showTimes);
    }
    refreshDisabled();
    enabledEl.addEventListener('change', refreshDisabled);
    mealsEl.addEventListener('change', refreshDisabled);

    function setStatus(msg, ok) {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.toggle('is-error', !ok);
      statusEl.classList.toggle('is-ok', !!ok);
    }

    container.querySelector('#notify-save').addEventListener('click', async () => {
      setStatus('Saving…', true);
      const times = {};
      container.querySelectorAll('input[type="time"][data-meal]').forEach((input) => {
        times[input.dataset.meal] = input.value;
      });
      const toddlerRef = document.body.dataset.toddlerId || loadPrefs().toddlerRef;
      const toddlerName = document.body.dataset.toddlerName || loadPrefs().toddlerName;
      const result = await saveSettingsFromForm({
        enabled: enabledEl.checked,
        mealReminders: mealsEl.checked,
        nutritionAlerts: alertsEl.checked,
        times,
        toddlerRef,
        toddlerName,
      });
      if (result.ok) {
        const n = result.scheduled || 0;
        setStatus(
          enabledEl.checked
            ? (n ? `Saved. ${n} daily meal reminder(s) scheduled.` : 'Saved. Notifications stay on for this device.')
            : 'Saved. Notifications are turned off.',
          true
        );
        if (typeof showToast === 'function') showToast('Notification settings saved', 'success');
        // refresh badge
        const badgeHost = container.querySelector('.notify-hero');
        if (badgeHost) {
          const old = badgeHost.querySelector('.notify-badge');
          if (old) old.outerHTML = permissionBadgeHtml(await checkPermissionState());
        }
      } else {
        setStatus(result.error || 'Could not save settings.', false);
        if (typeof showToast === 'function') showToast(result.error || 'Permission needed', 'error');
      }
    });

    container.querySelector('#notify-test').addEventListener('click', async () => {
      setStatus('Sending test…', true);
      const result = await sendTestNotification();
      if (result.ok) {
        setStatus('Test notification sent. Check your notification shade.', true);
        if (typeof showToast === 'function') showToast('Test notification sent', 'success');
      } else {
        setStatus(result.error || 'Test failed.', false);
        if (typeof showToast === 'function') showToast(result.error || 'Test failed', 'error');
      }
    });
  }

  global.LittleBowlNotifications = {
    loadPrefs,
    savePrefs,
    defaultPrefs,
    ensurePermissions,
    checkPermissionState,
    syncFromDashboard,
    enableAndSchedule,
    disableAll,
    saveSettingsFromForm,
    sendTestNotification,
    renderSettings,
    parseTime,
    mealId,
    alertFingerprint,
    DEFAULT_TIMES,
    MEAL_LABELS,
    MEAL_ORDER,
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Persist ON-by-default prefs immediately
    loadPrefs();
    bindNativeListeners();
    const mount = document.getElementById('notification-settings');
    if (mount) renderSettings(mount);

    const prefs = loadPrefs();
    if (prefs.enabled && prefs.mealReminders && !isNative()) {
      maybeWebMealNudge(prefs);
    }
  });
})(window);
