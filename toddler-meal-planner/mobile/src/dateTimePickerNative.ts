import { NativeModules, Platform } from 'react-native';

/** True when the dev/production binary includes @react-native-community/datetimepicker. */
export function dateTimePickerSupported(): boolean {
  if (Platform.OS === 'web') return false;
  return !!(NativeModules.RNCDatePicker || NativeModules.RNDateTimePicker);
}

type PickerModule = typeof import('@react-native-community/datetimepicker');

let cached: PickerModule | null | undefined;

/** Lazy-load the picker JS module only when native code is present. */
export function loadDateTimePicker(): PickerModule | null {
  if (!dateTimePickerSupported()) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@react-native-community/datetimepicker') as PickerModule;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
