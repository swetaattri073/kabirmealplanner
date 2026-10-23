import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import type { ReminderScheduleResult } from '../notifications';
import {
  androidSetupSteps,
  reminderResultMessage,
} from '../notifications';
import { colors, radii } from '../theme';

type Props = {
  visible: boolean;
  result: ReminderScheduleResult;
  testScheduled: boolean;
  onClose: () => void;
};

export function MealReminderSetupModal({ visible, result, testScheduled, onClose }: Props) {
  const [liveResult, setLiveResult] = useState(result);

  useEffect(() => {
    setLiveResult(result);
  }, [result]);

  useFocusEffect(
    useCallback(() => {
      if (!visible || Platform.OS === 'web') return;
      Notifications.getPermissionsAsync()
        .then((p) => {
          setLiveResult((prev) => ({ ...prev, permissionGranted: !!p.granted }));
        })
        .catch(() => undefined);
      Notifications.getAllScheduledNotificationsAsync()
        .then((all) => {
          const verified = all.filter(
            (r) => r.identifier.startsWith('meal-') && r.identifier !== 'meal-test',
          ).length;
          setLiveResult((prev) => ({ ...prev, verified }));
        })
        .catch(() => undefined);
    }, [visible]),
  );

  const steps = androidSetupSteps(liveResult);
  const allRequiredDone = steps.filter((s) => !s.recommended).every((s) => s.done);
  const title = allRequiredDone ? 'Reminders saved' : 'Finish reminder setup';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{reminderResultMessage(liveResult)}</Text>
          {testScheduled ? (
            <Text style={styles.hint}>A test alert will appear in about 10 seconds.</Text>
          ) : null}

          {Platform.OS === 'android' && steps.length > 0 ? (
            <View style={styles.steps}>
              <Text style={styles.stepsTitle}>Phone settings needed for on-time alerts</Text>
              {steps.map((step) => (
                <Pressable
                  key={step.id}
                  style={styles.stepRow}
                  onPress={step.onOpen}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.done ? 'Done' : 'Required'}: ${step.label}. ${step.description}`}
                >
                  <Text style={styles.stepIcon}>{step.done ? '✓' : '○'}</Text>
                  <View style={styles.stepText}>
                    <Text style={styles.stepLabel}>
                      {step.label}
                      {step.recommended && !step.done ? ' (recommended)' : ''}
                    </Text>
                    <Text style={styles.stepDesc}>{step.description}</Text>
                  </View>
                  <Text style={styles.stepAction}>{step.done ? 'Review' : 'Open'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable style={styles.doneBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>{allRequiredDone ? 'Done' : 'Continue'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 20,
    maxHeight: '90%',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginBottom: 12,
  },
  steps: {
    marginTop: 8,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  stepsTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  stepIcon: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.primary,
    width: 22,
    textAlign: 'center',
  },
  stepText: { flex: 1 },
  stepLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  stepDesc: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  stepAction: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.white,
  },
});
