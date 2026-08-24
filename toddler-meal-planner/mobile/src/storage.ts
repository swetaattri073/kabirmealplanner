import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'littlebowl_api_token';
const GUEST_KEY = 'littlebowl_guest_id';
const TODDLER_KEY = 'littlebowl_last_toddler_id';
const NOTIFY_KEY = 'littlebowl_notify_prefs_v2';

async function setSecure(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
    return;
  }
  if (value == null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

async function getSecure(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function getToken() {
  return getSecure(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  await setSecure(TOKEN_KEY, token);
}

export async function getGuestId() {
  return AsyncStorage.getItem(GUEST_KEY);
}

export async function setGuestId(id: string | null) {
  if (!id) await AsyncStorage.removeItem(GUEST_KEY);
  else await AsyncStorage.setItem(GUEST_KEY, id);
}

export async function getLastToddlerRef() {
  return AsyncStorage.getItem(TODDLER_KEY);
}

export async function setLastToddlerRef(ref: string | null) {
  if (!ref) await AsyncStorage.removeItem(TODDLER_KEY);
  else await AsyncStorage.setItem(TODDLER_KEY, ref);
}

export type NotifyPrefs = {
  enabled: boolean;
  mealReminders: boolean;
  nutritionAlerts: boolean;
  times: Record<string, string>;
  toddlerRef?: string | null;
  toddlerName?: string | null;
  // Meals this child actually has, from the server's per-age schedule.
  // Null means fall back to the full five.
  mealKeys?: string[] | null;
  /** User has chosen Enable or Not now on the in-app prompt (or saved reminders). */
  notificationsPrompted?: boolean;
};

export async function getNotifyPrefs(): Promise<NotifyPrefs | null> {
  const raw = await AsyncStorage.getItem(NOTIFY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setNotifyPrefs(prefs: NotifyPrefs) {
  await AsyncStorage.setItem(NOTIFY_KEY, JSON.stringify(prefs));
}

const WEANING_INTRO_KEY = 'littlebowl_seen_weaning_intro';

export async function getSeenWeaningIntro(): Promise<boolean> {
  const v = await AsyncStorage.getItem(WEANING_INTRO_KEY);
  return v === '1';
}

export async function setSeenWeaningIntro() {
  await AsyncStorage.setItem(WEANING_INTRO_KEY, '1');
}

const CHAT_COUNT_KEY = 'littlebowl_chat_count';

type ChatCount = { date: string; count: number };

export async function getChatCount(): Promise<ChatCount> {
  const today = new Date().toISOString().split('T')[0];
  const raw = await AsyncStorage.getItem(CHAT_COUNT_KEY);
  if (raw) {
    try {
      const parsed: ChatCount = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    } catch {}
  }
  return { date: today, count: 0 };
}

export async function incrementChatCount(): Promise<ChatCount> {
  const current = await getChatCount();
  const today = new Date().toISOString().split('T')[0];
  const next: ChatCount = {
    date: today,
    count: current.date === today ? current.count + 1 : 1,
  };
  await AsyncStorage.setItem(CHAT_COUNT_KEY, JSON.stringify(next));
  return next;
}

const CHAT_SESSION_PREFIX = 'littlebowl_chat_session_';
const CHAT_IDLE_MS = 15 * 60 * 1000;
const CHAT_MAX_RECENT = 10;

export type ChatMsg = { role: 'user' | 'assistant'; text: string };
export type ChatSession = { messages: ChatMsg[]; summary: string };

// Keyed per toddler so switching profiles doesn't bleed one conversation into
// another, matching the web widget's lb_chat_session_<toddlerId> scheme.
const chatSessionKey = (toddlerRef?: string | null) =>
  `${CHAT_SESSION_PREFIX}${toddlerRef || 'guest'}`;

function isValidChatMsg(m: any): m is ChatMsg {
  return (
    !!m &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.text === 'string' &&
    m.text.trim().length > 0
  );
}

export async function getChatSession(toddlerRef?: string | null): Promise<ChatSession> {
  const empty: ChatSession = { messages: [], summary: '' };
  try {
    const raw = await AsyncStorage.getItem(chatSessionKey(toddlerRef));
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const last = Number(data?.lastActivity) || 0;
    if (!last || Date.now() - last > CHAT_IDLE_MS) {
      await clearChatSession(toddlerRef);
      return empty;
    }
    const messages = Array.isArray(data.messages) ? data.messages.filter(isValidChatMsg) : [];
    return {
      messages: messages.slice(-CHAT_MAX_RECENT),
      summary: typeof data.summary === 'string' ? data.summary : '',
    };
  } catch {
    await clearChatSession(toddlerRef);
    return empty;
  }
}

export async function setChatSession(
  toddlerRef: string | null | undefined,
  session: ChatSession,
) {
  try {
    await AsyncStorage.setItem(
      chatSessionKey(toddlerRef),
      JSON.stringify({
        messages: session.messages.slice(-CHAT_MAX_RECENT),
        summary: session.summary,
        lastActivity: Date.now(),
      }),
    );
  } catch {
    // Device storage full or unavailable — fall back to in-memory only.
  }
}

export async function clearChatSession(toddlerRef?: string | null) {
  try {
    await AsyncStorage.removeItem(chatSessionKey(toddlerRef));
  } catch {
    // Nothing to recover from; the in-memory reset already happened.
  }
}
