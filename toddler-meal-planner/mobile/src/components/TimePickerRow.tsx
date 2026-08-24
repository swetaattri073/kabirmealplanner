import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { dateTimePickerSupported, loadDateTimePicker } from '../dateTimePickerNative';
import { colors, radii } from '../theme';

function parseHHMM(hhmm: string): Date {
  const [h, m] = (hhmm || '08:00').split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h || 8, m || 0, 0, 0);
  return d;
}

function formatHHMM(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TimePickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
}) {
  const [show, setShow] = useState(false);
  const nativePicker = dateTimePickerSupported();

  const onPickerChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (date) onChange(formatHHMM(date));
  };

  if (!nativePicker) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="08:00"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={`${label} reminder time, 24 hour format`}
        />
      </View>
    );
  }

  const DateTimePicker = loadDateTimePicker()?.default;
  if (!DateTimePicker) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setShow(true)}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={`${label} reminder time, ${value}`}
      >
        <Text style={styles.btnText}>{value}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={parseHHMM(value)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: { fontFamily: 'Nunito_600SemiBold', color: colors.text, flex: 1 },
  btn: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  btnText: { fontFamily: 'Nunito_700Bold', color: colors.text, fontSize: 16 },
  input: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
});
