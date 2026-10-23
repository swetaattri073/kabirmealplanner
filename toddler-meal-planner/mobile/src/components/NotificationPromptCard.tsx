import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  dismissNotificationPrompt,
  enableMealReminders,
  loadNotifyPrefs,
  sendTestMealReminder,
  showMealReminderBlockedAlert,
  type ReminderScheduleResult,
} from '../notifications';
import { MealReminderSetupModal } from './MealReminderSetupModal';
import { colors, radii } from '../theme';

export function NotificationPromptCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setupModal, setSetupModal] = useState<{
    result: ReminderScheduleResult;
    testScheduled: boolean;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadNotifyPrefs().then((p) => {
        setVisible(!p.notificationsPrompted);
      });
    }, []),
  );

  if (!visible && !setupModal) return null;

  const onEnable = async () => {
    setBusy(true);
    try {
      const result = await enableMealReminders();
      if (!result.permissionGranted || result.scheduled === 0) {
        showMealReminderBlockedAlert(result);
        return;
      }
      const testOk = await sendTestMealReminder();
      setVisible(false);
      setSetupModal({ result, testScheduled: testOk });
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = async () => {
    await dismissNotificationPrompt();
    setVisible(false);
  };

  return (
    <>
      {visible ? (
        <View style={styles.wrap}>
          <Text style={styles.title}>Get meal reminders?</Text>
          <Text style={styles.body}>
            We can nudge you at breakfast and lunch time so logging stays easy.
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onEnable}
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Enable meal reminders"
            >
              <Text style={styles.primaryText}>{busy ? 'Setting up…' : 'Enable'}</Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <MealReminderSetupModal
        visible={!!setupModal}
        result={setupModal?.result ?? { scheduled: 0, permissionGranted: false, verified: 0, nextReminderAt: null }}
        testScheduled={setupModal?.testScheduled ?? false}
        onClose={() => setSetupModal(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: radii.md,
    backgroundColor: colors.bgTertiary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { fontFamily: 'Nunito_700Bold', color: colors.white, fontSize: 15 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  secondaryText: { fontFamily: 'Nunito_700Bold', color: colors.textSecondary, fontSize: 15 },
  disabled: { opacity: 0.6 },
});
