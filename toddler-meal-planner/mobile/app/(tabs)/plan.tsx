import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, MEAL_LABELS, MEAL_ORDER } from '../../src/theme';

export default function PlanScreen() {
  const { activeToddler } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (regenerate = false) => {
      if (!activeToddler) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.weeklyPlan(activeToddler.ref, undefined, regenerate);
        setPlan(data);
      } catch (e: any) {
        Alert.alert('Plan error', e?.message || 'Could not load plan');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeToddler],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(false);
    }, [load]),
  );

  if (!activeToddler) {
    return (
      <Screen>
        <AppHeader title="Weekly plan" />
        <EmptyState text="Add a toddler to see the weekly plan." />
      </Screen>
    );
  }

  const days = plan?.days || [];

  return (
    <Screen>
      <AppHeader title="Weekly plan" />
      {loading && !plan ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
            />
          }
        >
          <Button
            label="Regenerate plan"
            variant="secondary"
            onPress={() => {
              setLoading(true);
              load(true);
            }}
          />
          {days.map((day: any) => (
            <Card key={day.date || day.day_of_week}>
              <Text style={styles.day}>
                {day.weekday || day.day_name || day.date}
              </Text>
              {MEAL_ORDER.filter((m) => (day.meals || {})[m]).map((meal) => {
                const info = (day.meals || {})[meal] as any;
                const name =
                  info?.summary ||
                  info?.food?.name ||
                  info?.main?.name ||
                  info?.name ||
                  '—';
                return (
                  <View key={meal} style={styles.row}>
                    <Text style={styles.meal}>{MEAL_LABELS[meal] || meal}</Text>
                    <Text style={styles.food} numberOfLines={2}>
                      {name}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ))}
          {!days.length ? <EmptyState text="No plan days returned." /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  day: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  meal: { fontFamily: 'Nunito_700Bold', color: colors.primary, fontSize: 13 },
  food: { fontFamily: 'Nunito_400Regular', color: colors.text },
});
