import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { DEFAULT_REMINDER_TIMES, MEAL_LABELS } from './theme';
import {
  getNotifyPrefs,
  setNotifyPrefs,
  type NotifyPrefs,
} from './storage';

const MEAL_REMINDER_CHANNEL = 'meal-reminders-v2';
/** Queue this many days of one-shot alarms (refreshed on app open). */
const DAYS_AHEAD = 7;

export type ReminderScheduleResult = {
  scheduled: number;
  permissionGranted: boolean;
  verified: number;
  nextReminderAt: Date | null;
};

let reminderSyncStarted = false;

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

export async function saveNotifyPrefs(prefs: NotifyPrefs): Promise<ReminderScheduleResult> {
  await setNotifyPrefs(prefs);
  return rescheduleMealReminders(prefs);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return !!req.granted;
  } catch {
    return false;
  }
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const opened = await openAppNotificationSettings();
    if (opened) return;
  }
  try {
    await Linking.openSettings();
  } catch {
    /* ignore */
  }
}

/** Opens this app's notification toggles (Android 8+). */
export async function openAppNotificationSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const pkg = Application.applicationId;
  if (!pkg) return false;
  try {
    await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: pkg },
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Opens battery optimization / unrestricted battery for this app (Samsung, Pixel, etc.). */
export async function openBatterySettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const pkg = Application.applicationId;
  if (!pkg) return false;
  try {
    await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
      { key: 'package', value: pkg },
    ]);
    return true;
  } catch {
    /* fall through */
  }
  try {
    await Linking.openURL(`package:${pkg}`);
    return true;
  } catch {
    return false;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = Application.applicationId;
  try {
    if (pkg) {
      await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', [
        { key: 'android.intent.extra.PACKAGE_NAME', value: pkg },
      ]);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    if (pkg) {
      await Linking.openURL(`package:${pkg}`);
      return;
    }
  } catch {
    /* fall through */
  }
  await openNotificationSettings();
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = (hhmm || '08:00').split(':').map((x) => parseInt(x, 10));
  return { hour: h || 8, minute: m || 0 };
}

function upcomingMealDates(hour: number, minute: number, count: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setSeconds(0, 0);

  for (let offset = 0; offset < count + 14 && out.length < count; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() > Date.now() + 5000) {
      out.push(d);
    }
  }
  return out;
}

export function nextReminderDate(prefs: NotifyPrefs): Date | null {
  const keys = mealKeysFor(prefs);
  const all = keys.flatMap((key) => {
    const { hour, minute } = parseTime(prefs.times[key] || DEFAULT_REMINDER_TIMES[key]);
    return upcomingMealDates(hour, minute, 1);
  });
  if (!all.length) return null;
  return all.sort((a, b) => a.getTime() - b.getTime())[0];
}

function secondsUntil(date: Date): number {
  const sec = Math.floor((date.getTime() - Date.now()) / 1000);
  return Math.max(15, sec);
}

function mealReminderIds(): string[] {
  const ids = ['meal-test'];
  for (const key of MEAL_ORDER) {
    ids.push(`meal-${key}`);
    for (let d = 0; d < DAYS_AHEAD; d += 1) {
      ids.push(`meal-${key}-d${d}`);
    }
  }
  return ids;
}

async function cancelMealReminders() {
  await Promise.all(
    mealReminderIds().map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
}

async function ensureMealReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MEAL_REMINDER_CHANNEL, {
    name: 'Meal reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  });
}

async function countVerifiedMealAlarms(): Promise<number> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((r) => r.identifier.startsWith('meal-') && r.identifier !== 'meal-test').length;
  } catch {
    return 0;
  }
}

let lastReminderSyncAt = 0;
const REMINDER_SYNC_MIN_INTERVAL_MS = 60 * 60 * 1000;

async function refreshRemindersIfEnabled() {
  const prefs = await loadNotifyPrefs();
  if (prefs.notificationsPrompted && prefs.enabled && prefs.mealReminders) {
    const now = Date.now();
    if (now - lastReminderSyncAt < REMINDER_SYNC_MIN_INTERVAL_MS) return;
    lastReminderSyncAt = now;
    await rescheduleMealReminders(prefs);
  }
}

export function initMealReminderSync() {
  if (reminderSyncStarted || !notificationsSupported()) return;
  reminderSyncStarted = true;

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      refreshRemindersIfEnabled().catch(() => undefined);
    }
  });
}

async function scheduleMealAlarm(
  identifier: string,
  date: Date,
  content: Notifications.NotificationContentInput,
): Promise<boolean> {
  const seconds = secondsUntil(date);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: Platform.OS === 'android' ? MEAL_REMINDER_CHANNEL : undefined,
      },
    });
    return true;
  } catch (err) {
    console.warn('schedule reminder failed', identifier, err);
    return false;
  }
}

export async function rescheduleMealReminders(prefs?: NotifyPrefs): Promise<ReminderScheduleResult> {
  const p = prefs || (await loadNotifyPrefs());
  const empty: ReminderScheduleResult = {
    scheduled: 0,
    permissionGranted: false,
    verified: 0,
    nextReminderAt: null,
  };

  if (!notificationsSupported()) return empty;

  try {
    await cancelMealReminders();
  } catch {
    return empty;
  }

  if (!p.notificationsPrompted || !p.enabled || !p.mealReminders) {
    return { ...empty, permissionGranted: true };
  }

  const ok = await ensureNotificationPermission();
  if (!ok) return empty;

  try {
    await ensureMealReminderChannel();
  } catch {
    return { scheduled: 0, permissionGranted: ok, verified: 0, nextReminderAt: nextReminderDate(p) };
  }

  const name = p.toddlerName || 'your child';
  const keys = mealKeysFor(p);
  let scheduled = 0;

  // TIME_INTERVAL uses the same Android alarm path as the 10s test alert (which
  // works). DATE/DAILY triggers are often dropped without exact-alarm permission.
  const scheduleJobs: Promise<boolean>[] = [];
  for (const key of keys) {
    const { hour, minute } = parseTime(p.times[key] || DEFAULT_REMINDER_TIMES[key]);
    const label = MEAL_LABELS[key] || key;
    const dates = upcomingMealDates(hour, minute, DAYS_AHEAD);
    const content: Notifications.NotificationContentInput = {
      title: `Time for ${label}`,
      body: `Log ${name}'s ${label.toLowerCase()} in LittleBowl.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { meal_type: key, toddlerRef: p.toddlerRef },
    };

    for (let index = 0; index < dates.length; index += 1) {
      scheduleJobs.push(scheduleMealAlarm(`meal-${key}-d${index}`, dates[index], content));
    }
  }
  const results = await Promise.all(scheduleJobs);
  scheduled = results.filter(Boolean).length;

  const verified = await countVerifiedMealAlarms();
  const nextReminderAt = nextReminderDate(p);

  return { scheduled, permissionGranted: ok, verified, nextReminderAt };
}

export async function enableMealReminders(prefs?: NotifyPrefs): Promise<ReminderScheduleResult> {
  const p = prefs || (await loadNotifyPrefs());
  p.notificationsPrompted = true;
  p.mealReminders = true;
  const permissionGranted = await ensureNotificationPermission();
  p.enabled = permissionGranted;
  await setNotifyPrefs(p);
  if (!permissionGranted) {
    return { scheduled: 0, permissionGranted: false, verified: 0, nextReminderAt: null };
  }
  return rescheduleMealReminders(p);
}

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
    const keys = [...(mealSchedule?.meals || []), ...(mealSchedule?.snacks || [])];
    prefs.mealKeys = keys.length ? keys : null;
    await setNotifyPrefs(prefs);
    if (prefs.notificationsPrompted && prefs.enabled) {
      await rescheduleMealReminders(prefs);
    }
  } catch (err) {
    console.warn('syncRemindersFromToddler failed', err);
  }
}

export async function sendTestMealReminder(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const ok = await ensureNotificationPermission();
  if (!ok) return false;
  try {
    await ensureMealReminderChannel();
    await Notifications.cancelScheduledNotificationAsync('meal-test').catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: 'meal-test',
      content: {
        title: 'LittleBowl reminders work',
        body: 'You will get alerts at your chosen meal times each day.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        channelId: Platform.OS === 'android' ? MEAL_REMINDER_CHANNEL : undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
}

function formatReminderTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function reminderResultMessage(result: ReminderScheduleResult): string {
  if (!result.permissionGranted) {
    return 'Notification permission was denied. Enable notifications for LittleBowl in your phone settings.';
  }
  if (result.scheduled === 0) {
    return 'Reminders are off or could not be scheduled. Turn reminders ON and save again.';
  }
  const meals = Math.round(result.scheduled / DAYS_AHEAD) || result.scheduled;
  let msg = `${meals} meal time${meals === 1 ? '' : 's'} queued for the next ${DAYS_AHEAD} days.`;
  if (result.nextReminderAt) {
    msg += ` Next alert: ${formatReminderTime(result.nextReminderAt)}.`;
  }
  if (result.verified === 0 && result.scheduled > 0) {
    msg += ' Warning: phone did not confirm queued alarms — allow Alarms & reminders for LittleBowl.';
  }
  return msg;
}

export function androidAlarmHint(): string {
  if (Platform.OS !== 'android') return '';
  return (
    '\n\nOn Android, allow Notifications, Alarms & reminders, and set Battery to Unrestricted ' +
    'so meal alerts arrive on time.'
  );
}

export type MealReminderSetupStep = {
  id: 'notifications' | 'alarms' | 'battery';
  label: string;
  description: string;
  done: boolean;
  recommended?: boolean;
  onOpen: () => void;
};

export function androidSetupSteps(result: ReminderScheduleResult): MealReminderSetupStep[] {
  if (Platform.OS !== 'android') return [];

  const notificationsDone = result.permissionGranted;
  const alarmsDone =
    result.scheduled === 0 || (result.verified > 0 && result.verified >= result.scheduled);

  return [
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Allow LittleBowl to show meal alerts.',
      done: notificationsDone,
      onOpen: () => {
        openAppNotificationSettings().catch(() => openNotificationSettings());
      },
    },
    {
      id: 'alarms',
      label: 'Alarms & reminders',
      description: 'Lets the app fire alerts at the exact meal times you set.',
      done: alarmsDone,
      onOpen: () => {
        openExactAlarmSettings();
      },
    },
    {
      id: 'battery',
      label: 'Battery (Unrestricted)',
      description: 'Prevents Android from delaying or dropping timed reminders.',
      done: false,
      recommended: true,
      onOpen: () => {
        openBatterySettings();
      },
    },
  ];
}

/** Show blocked-permission alert with direct links to each required setting. */
export function showMealReminderBlockedAlert(result: ReminderScheduleResult): void {
  const steps = androidSetupSteps(result);
  const msg = `${reminderResultMessage(result)}${androidAlarmHint()}`;
  if (Platform.OS !== 'android') {
    Alert.alert('Notifications blocked', msg, [
      { text: 'Open settings', onPress: () => openNotificationSettings() },
      { text: 'OK' },
    ]);
    return;
  }
  Alert.alert('Notifications blocked', msg, [
    { text: 'Notifications', onPress: steps[0]?.onOpen },
    { text: 'Alarms', onPress: steps[1]?.onOpen },
    { text: 'OK' },
  ]);
}
