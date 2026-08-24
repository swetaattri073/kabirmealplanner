import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { dateTimePickerSupported, loadDateTimePicker } from '../dateTimePickerNative';
import { formatBirthDateISO, formatDisplayDate, parseBirthDate } from '../dateUtils';
import { colors, radii } from '../theme';

export { ageMonthsFromBirth, formatBirthDateISO } from '../dateUtils';

export function DatePickerRow({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  helper,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  helper?: string;
}) {
  const [show, setShow] = useState(false);
  const [textFallback, setTextFallback] = useState(formatBirthDateISO(value));
  const nativePicker = dateTimePickerSupported();

  const onPickerChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (date) {
      onChange(date);
      setTextFallback(formatBirthDateISO(date));
    }
  };

  if (!nativePicker) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
        <TextInput
          value={textFallback}
          onChangeText={(t) => {
            setTextFallback(t);
            const parsed = parseBirthDate(t);
            if (parsed) onChange(parsed);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={label}
        />
        <Text style={styles.fallbackHint}>Use YYYY-MM-DD (native picker after app rebuild)</Text>
      </View>
    );
  }

  const DateTimePicker = loadDateTimePicker()?.default;
  if (!DateTimePicker) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <Pressable
        onPress={() => setShow(true)}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDisplayDate(value)}`}
      >
        <Text style={styles.btnText}>{formatDisplayDate(value)}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    marginBottom: 4,
    color: colors.text,
  },
  helper: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  btnText: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.white,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  fallbackHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
});
