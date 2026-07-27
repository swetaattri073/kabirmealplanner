/**
 * LittleBowl notifications — meal log reminders + nutrition alerts.
 *
 * Uses Capacitor Local Notifications inside the Android app, with a
 * Web Notification API fallback for installed PWAs / desktop Chrome.
 */
(function (global) {
  const PREF_KEY = 'littlebowl_notify_prefs_v1';
  const ALERT_SEEN_KEY = 'littlebowl_alert_notified_v1';

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

  // Stable notification ids (Android requires int ids)
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

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return defaultPrefs();
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

  async function scheduleMealReminders(prefs) {
    await cancelMealReminders();
    if (!prefs.enabled || !prefs.mealReminders) return;

    const granted = await ensurePermissions();
    if (!granted) return;

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
        channelId: 'meal-reminders',
        smallIcon: 'ic_stat_littlebowl',
        extra: {
          type: 'meal_reminder',
          mealType,
          toddlerRef: prefs.toddlerRef,
        },
      });
    });

    if (!notifications.length) return;

    if (LN) {
      try {
        await LN.createChannel?.({
          id: 'meal-reminders',
          name: 'Meal reminders',
          description: 'Reminders to log breakfast, lunch, dinner, and snacks',
          importance: 4,
          visibility: 1,
          sound: 'default',
        });
      } catch (e) { /* older plugin */ }
      await LN.schedule({ notifications });
      return;
    }

    // Web fallback: cannot schedule exact daily alarms without a service worker push
    // backend. Show a one-shot toast-like notification only if a meal is due soon.
    maybeWebMealNudge(prefs);
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
      // Within 5 minutes after the scheduled time, once per day per meal
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
    if (!prefs.enabled || !prefs.nutritionAlerts) return;
    if (!alerts || !alerts.length) return;

    const actionable = alerts.filter((a) =>
      a && (a.severity === 'critical' || a.severity === 'warning')
    );
    if (!actionable.length) return;

    const granted = await ensurePermissions();
    if (!granted) return;

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
        } catch (e) { /* ignore */ }
      }
    }

    saveAlertSeen(seen);

    if (LN && toSchedule.length) {
      try {
        await LN.createChannel?.({
          id: 'nutrition-alerts',
          name: 'Nutrition alerts',
          description: 'Warnings when key nutrients look low',
          importance: 5,
          visibility: 1,
          sound: 'default',
        });
      } catch (e) { /* ignore */ }
      await LN.schedule({ notifications: toSchedule });
    }
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
      LN.addListener('localNotificationReceived', () => {
        /* delivered while app in foreground — no-op */
      });
    } catch (e) {
      console.warn('notification listeners', e);
    }
  }

  /**
   * Sync reminders + alerts from dashboard (or nutrition) payload.
   */
  async function syncFromDashboard(data) {
    if (!data || !data.toddler) return;
    const prefs = loadPrefs();
    prefs.toddlerRef = data.toddler.ref || data.toddler.id;
    prefs.toddlerName = data.toddler.name || prefs.toddlerName;
    savePrefs(prefs);

    bindNativeListeners();

    if (!prefs.enabled) {
      await cancelMealReminders();
      return;
    }

    // Prefer schedule meal list from toddler profile when present
    const schedule = data.toddler.meal_schedule || data.schedule || {};
    const slots = []
      .concat(schedule.meals || [])
      .concat(schedule.snacks || []);
    // Keep default times for known slots; leave prefs.times as configured
    if (slots.length) {
      // Ensure times exist for each scheduled slot
      slots.forEach((slot) => {
        if (!prefs.times[slot] && DEFAULT_TIMES[slot]) {
          prefs.times[slot] = DEFAULT_TIMES[slot];
        }
      });
      savePrefs(prefs);
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
    await scheduleMealReminders(prefs);
    return { ok: true, prefs };
  }

  function renderSettings(container) {
    if (!container) return;
    const prefs = loadPrefs();
    const native = isNative();

    container.innerHTML = `
      <div class="notify-settings">
        <p class="notify-lead">
          ${native
            ? 'Get Android reminders to log meals and warnings when nutrition looks low.'
            : 'Enable browser notifications for meal reminders (while LittleBowl is open) and nutrition alerts.'}
        </p>
        <label class="notify-toggle">
          <input type="checkbox" id="notify-enabled" ${prefs.enabled ? 'checked' : ''}>
          <span>Enable notifications</span>
        </label>
        <label class="notify-toggle">
          <input type="checkbox" id="notify-meals" ${prefs.mealReminders ? 'checked' : ''} ${prefs.enabled ? '' : 'disabled'}>
          <span>Meal log reminders</span>
        </label>
        <label class="notify-toggle">
          <input type="checkbox" id="notify-alerts" ${prefs.nutritionAlerts ? 'checked' : ''} ${prefs.enabled ? '' : 'disabled'}>
          <span>Nutrition alerts</span>
        </label>
        <div class="notify-times" id="notify-times" style="${prefs.enabled && prefs.mealReminders ? '' : 'opacity:0.55;pointer-events:none;'}">
          <h4>Reminder times</h4>
          ${MEAL_ORDER.map((meal) => `
            <label class="notify-time-row">
              <span>${MEAL_LABELS[meal]}</span>
              <input type="time" data-meal="${meal}" value="${prefs.times[meal] || DEFAULT_TIMES[meal]}">
            </label>
          `).join('')}
        </div>
        <button type="button" class="btn btn-primary" id="notify-save">
          <i class="fas fa-bell"></i> Save notification settings
        </button>
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
      timesWrap.style.opacity = on && mealsEl.checked ? '1' : '0.55';
      timesWrap.style.pointerEvents = on && mealsEl.checked ? 'auto' : 'none';
    }
    enabledEl.addEventListener('change', refreshDisabled);
    mealsEl.addEventListener('change', refreshDisabled);

    container.querySelector('#notify-save').addEventListener('click', async () => {
      statusEl.hidden = false;
      statusEl.textContent = 'Saving…';
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
        statusEl.textContent = 'Saved. Meal reminders are scheduled on this device.';
        if (typeof showToast === 'function') showToast('Notification settings saved', 'success');
      } else {
        statusEl.textContent = result.error || 'Could not save settings.';
        if (typeof showToast === 'function') showToast(result.error || 'Permission needed', 'error');
      }
    });
  }

  // Public API
  global.LittleBowlNotifications = {
    loadPrefs,
    savePrefs,
    ensurePermissions,
    syncFromDashboard,
    enableAndSchedule,
    disableAll,
    saveSettingsFromForm,
    renderSettings,
    DEFAULT_TIMES,
    MEAL_LABELS,
    MEAL_ORDER,
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindNativeListeners();
    const mount = document.getElementById('notification-settings');
    if (mount) renderSettings(mount);

    // Lightweight web nudge when prefs already enabled
    const prefs = loadPrefs();
    if (prefs.enabled && prefs.mealReminders && !isNative()) {
      maybeWebMealNudge(prefs);
    }
  });
})(window);
