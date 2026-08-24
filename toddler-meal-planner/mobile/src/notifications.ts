import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEFAULT_REMINDER_TIMES, MEAL_LABELS } from './theme';
import {
  getNotifyPrefs,
  setNotifyPrefs,
  type NotifyPrefs,
} from './storage';

/**
 * Expo Go (SDK 53+) removed Android remote-notification support and can throw
 * when notifications APIs are touched. Skip scheduling there; use a
 * development / production build for real reminders.
 */
export function notificationsSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

try {
  if (notificationsSupported()) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  /* Expo Go / unsupported */
}

const MEAL_ORDER = Object.keys(DEFAULT_REMINDER_TIMES);

/** Meals to remind about, in the app's canonical order. */
export function mealKeysFor(prefs: Pick<NotifyPrefs, 'mealKeys'>): string[] {
  const wanted = prefs.mealKeys;
  if (!wanted || !wanted.length) return MEAL_ORDER;
  const allowed = new Set(wanted);
  return MEAL_ORDER.filter((k) => allowed.has(k));
}

function defaultPrefs(): NotifyPrefs {
  return {
    enabled: false,
    mealReminders: true,
    nutritionAlerts: true,
    times: { ...DEFAULT_REMINDER_TIMES },
    toddlerRef: null,
    toddlerName: null,
    notificationsPrompted: false,
  };
}

export async function loadNotifyPrefs(): Promise<NotifyPrefs> {
  const existing = await getNotifyPrefs();
  if (!existing) {
    const d = defaultPrefs();
    await setNotifyPrefs(d);
    return d;
  }
  return {
    ...defaultPrefs(),
    ...existing,
    times: { ...DEFAULT_REMINDER_TIMES, ...(existing.times || {}) },
  };
}

export async function saveNotifyPrefs(prefs: NotifyPrefs) {
  await setNotifyPrefs(prefs);
  await rescheduleMealReminders(prefs);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  } catch {
    return false;
  }
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = (hhmm || '08:00').split(':').map((x) => parseInt(x, 10));
  return { hour: h || 8, minute: m || 0 };
}

export async function rescheduleMealReminders(prefs?: NotifyPrefs) {
  const p = prefs || (await loadNotifyPrefs());
  if (!notificationsSupported()) return;

  // Clear before any early return. Bailing out first meant that switching
  // reminders off left the previous schedule running, so "off" never actually
  // stopped the daily notifications.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  if (!p.notificationsPrompted || !p.enabled || !p.mealReminders) return;

  const ok = await ensureNotificationPermission();
  if (!ok) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meal-reminders', {
        name: 'Meal reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  } catch {
    return;
  }

  const name = p.toddlerName || 'your child';
  // Only remind for meals this child actually has. A 6-month-old is planned
  // two meals a day, so reminding them about an evening snack is noise.
  for (const key of mealKeysFor(p)) {
    const { hour, minute } = parseTime(p.times[key] || DEFAULT_REMINDER_TIMES[key]);
    const label = MEAL_LABELS[key] || key;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `meal-${key}`,
        content: {
          title: `Time for ${label}`,
          body: `Log ${name}'s ${label.toLowerCase()} in LittleBowl.`,
          sound: true,
          data: { meal_type: key, toddlerRef: p.toddlerRef },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: Platform.OS === 'android' ? 'meal-reminders' : undefined,
        },
      });
    } catch (err) {
      console.warn('schedule reminder failed', key, err);
    }
  }
}

/** User tapped Enable on the Home prompt or saved reminders in Account. */
export async function enableMealReminders(prefs?: NotifyPrefs): Promise<boolean> {
  const p = prefs || (await loadNotifyPrefs());
  p.notificationsPrompted = true;
  p.enabled = true;
  p.mealReminders = true;
  await setNotifyPrefs(p);
  await rescheduleMealReminders(p);
  return p.enabled;
}

/** User dismissed the in-app prompt without enabling. */
export async function dismissNotificationPrompt(): Promise<void> {
  const p = await loadNotifyPrefs();
  p.notificationsPrompted = true;
  p.enabled = false;
  await setNotifyPrefs(p);
}

export async function syncRemindersFromToddler(
  toddlerRef: string | null,
  toddlerName: string | null,
  mealSchedule?: { meals?: string[]; snacks?: string[] } | null,
) {
  try {
    const prefs = await loadNotifyPrefs();
    prefs.toddlerRef = toddlerRef;
    prefs.toddlerName = toddlerName;
    // The server already tailors this per child by age, so the client does not
    // have to duplicate the age rules.
    const keys = [...(mealSchedule?.meals || []), ...(mealSchedule?.snacks || [])];
    prefs.mealKeys = keys.length ? keys : null;
    await setNotifyPrefs(prefs);
    if (prefs.notificationsPrompted) {
      await rescheduleMealReminders(prefs);
    }
  } catch (err) {
    console.warn('syncRemindersFromToddler failed', err);
  }
}
