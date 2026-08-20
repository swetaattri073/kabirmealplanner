import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_KEY = 'littlebowl_device_id';

let cached: string | null = null;

// Only needs to be collision-free, not unguessable — it is a last resort for
// platforms that hand us no stable identifier of their own.
function randomId(): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(DEVICE_KEY);
    return await SecureStore.getItemAsync(DEVICE_KEY);
  } catch {
    return null;
  }
}

async function writeStored(value: string) {
  try {
    if (Platform.OS === 'web') await AsyncStorage.setItem(DEVICE_KEY, value);
    else await SecureStore.setItemAsync(DEVICE_KEY, value);
  } catch {
    // Non-fatal — the id still works for this session, it just won't persist.
  }
}

/**
 * A device identifier that survives an app reinstall, used server-side to keep
 * the free chat allowance from resetting.
 *
 * IMEI is unavailable to third-party apps from Android 10 onward, so this uses
 * the platform's sanctioned equivalents. Both are defeatable by a factory reset;
 * the goal is to make casual abuse cost more than it is worth.
 */
export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;

  // SSAID is scoped to our signing key and already outlives a reinstall, so it
  // needs no storage of its own.
  if (Platform.OS === 'android') {
    try {
      const ssaid = Application.getAndroidId();
      if (ssaid) {
        cached = `android_${ssaid}`;
        return cached;
      }
    } catch {
      // Fall through and mint one we store ourselves.
    }
  }

  // Keychain entries outlive an uninstall on iOS, which is what carries this
  // across a reinstall; identifierForVendor on its own resets once every app
  // from the vendor is gone.
  const stored = await readStored();
  if (stored) {
    cached = stored;
    return cached;
  }

  let seed: string | null = null;
  if (Platform.OS === 'ios') {
    try {
      seed = await Application.getIosIdForVendorAsync();
    } catch {
      seed = null;
    }
  }

  const value = `${Platform.OS}_${seed || randomId()}`;
  await writeStored(value);
  cached = value;
  return value;
}
