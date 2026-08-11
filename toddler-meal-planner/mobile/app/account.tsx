import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import {
  loadNotifyPrefs,
  saveNotifyPrefs,
} from '../src/notifications';
import type { NotifyPrefs } from '../src/storage';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Card, Field, Screen } from '../src/components/ui';
import { colors, DEFAULT_REMINDER_TIMES, MEAL_LABELS, radii } from '../src/theme';

export default function AccountScreen() {
  const { user, authenticated, logout, activeToddler } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotifyPrefs().then(setPrefs);
  }, []);

  const updateTime = (key: string, value: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, times: { ...prefs.times, [key]: value } });
  };

  const saveReminders = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const next = {
        ...prefs,
        toddlerRef: activeToddler?.ref || prefs.toddlerRef,
        toddlerName: activeToddler?.name || prefs.toddlerName,
      };
      await saveNotifyPrefs(next);
      setPrefs(next);
      Alert.alert('Saved', 'Meal reminders updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <Screen>
      <AppHeader title="My account" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Card>
          <Text style={styles.h}>Profile</Text>
          {authenticated && user ? (
            <>
              <Text style={styles.line}>{user.name || 'Parent'}</Text>
              <Text style={styles.meta}>{user.email}</Text>
              <Button label="Sign out" variant="danger" onPress={onLogout} />
            </>
          ) : (
            <>
              <Text style={styles.meta}>You are using LittleBowl as a guest.</Text>
              <Button label="Create account" onPress={() => router.push('/register')} />
              <Button label="Sign in" variant="ghost" onPress={() => router.push('/login')} />
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.h}>Meal reminders</Text>
          <Text style={styles.meta}>
            On by default. Edit times (24h HH:MM). Same feature as the website.
          </Text>
          {prefs ? (
            <>
              <Button
                label={prefs.enabled ? 'Reminders: ON' : 'Reminders: OFF'}
                variant={prefs.enabled ? 'primary' : 'secondary'}
                onPress={() => setPrefs({ ...prefs, enabled: !prefs.enabled })}
              />
              {Object.keys(DEFAULT_REMINDER_TIMES).map((key) => (
                <View key={key} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{MEAL_LABELS[key]}</Text>
                  <TextInput
                    value={prefs.times[key] || DEFAULT_REMINDER_TIMES[key]}
                    onChangeText={(t) => updateTime(key, t)}
                    style={styles.timeInput}
                    placeholder="08:00"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <Button label="Save reminders" onPress={saveReminders} loading={saving} />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  line: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: colors.text },
  meta: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeLabel: { fontFamily: 'Nunito_600SemiBold', color: colors.text, flex: 1 },
  timeInput: {
    width: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.white,
  },
});
