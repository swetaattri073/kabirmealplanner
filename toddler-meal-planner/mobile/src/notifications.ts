import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEFAULT_REMINDER_TIMES, MEAL_LABELS } from './theme';
import { pickReminderCopy } from './reminderCopy';
import {
  getNotifyPrefs,
  setNotifyPrefs,
  type NotifyPrefs,
} from './storage';

/** Bumped channel id so HIGH importance applies on existing installs. */
const ANDROID_CHANNEL_ID = 'meal-reminders-v2';

/**
 * Expo Go (SDK 53+) removed Android remote-notification support and can throw
 * when notifications APIs are touched. Skip scheduling there; use a
 * development / production build for real reminders.
 */
export function notificationsSupported(): boolean {
  if (Platform.OS === 'web') return false;
  // Expo Go: appOwnership === 'expo'
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

try {
  if (notificationsSupported()) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
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

function defaultPrefs(): NotifyPrefs {
  return {
    enabled: true,
    mealReminders: true,
    nutritionAlerts: true,
    times: { ...DEFAULT_REMINDER_TIMES },
    toddlerRef: null,
    toddlerName: null,
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
  if (!p.enabled || !p.mealReminders) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  const ok = await ensureNotificationPermission();
  if (!ok) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Meal reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 100, 180],
        lightColor: '#6b8f3c',
      });
    }
  } catch {
    return;
  }

  const name = p.toddlerName || 'your little one';
  for (let i = 0; i < MEAL_ORDER.length; i++) {
    const key = MEAL_ORDER[i];
    const { hour, minute } = parseTime(p.times[key] || DEFAULT_REMINDER_TIMES[key]);
    const label = MEAL_LABELS[key] || key;
    const { title, body } = pickReminderCopy(key, label, name);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `meal-${key}`,
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#6b8f3c',
          data: { meal_type: key, toddlerRef: p.toddlerRef },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
        },
      });
    } catch (err) {
      console.warn('schedule reminder failed', key, err);
    }
  }
}

export async function syncRemindersFromToddler(
  toddlerRef: string | null,
  toddlerName: string | null,
) {
  try {
    const prefs = await loadNotifyPrefs();
    prefs.toddlerRef = toddlerRef;
    prefs.toddlerName = toddlerName;
    await saveNotifyPrefs(prefs);
  } catch (err) {
    console.warn('syncRemindersFromToddler failed', err);
  }
}
