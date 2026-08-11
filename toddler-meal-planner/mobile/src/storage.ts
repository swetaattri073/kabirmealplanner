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
