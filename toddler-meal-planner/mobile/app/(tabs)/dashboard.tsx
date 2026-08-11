import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, MEAL_LABELS, radii } from '../../src/theme';
import type { DashboardData } from '../../src/types';

export default function DashboardScreen() {
  const { activeToddler, toddlers } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.dashboard(activeToddler.ref);
      setData(d);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeToddler]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (!activeToddler && toddlers.length === 0) {
    return (
      <Screen>
        <AppHeader title="Dashboard" />
        <EmptyState text="Add a toddler profile to get started." />
        <View style={{ padding: 24 }}>
          <Button label="Set up profile" onPress={() => router.push('/onboarding')} />
        </View>
      </Screen>
    );
  }

  const schedule = [
    ...(data?.schedule?.meals || []),
    ...(data?.schedule?.snacks || []),
  ];
  const nutrients = Object.entries(data?.nutrition?.nutrients || {}).slice(0, 6);

  return (
    <Screen>
      <AppHeader title="Dashboard" />
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          <Card>
            <Text style={styles.h}>Today</Text>
            <Text style={styles.meta}>
              Streak: {data?.logging_stats?.current_streak ?? 0} days · Logged{' '}
              {data?.meals_eaten?.length || 0}/{schedule.length || 5} meals
            </Text>
            {schedule.map((meal) => {
              const eaten = data?.meals_eaten?.includes(meal);
              const planMeal = data?.today_plan?.meals?.[meal];
              const planName =
                planMeal?.summary ||
                planMeal?.food?.name ||
                planMeal?.main?.name ||
                'Suggested meal';
              return (
                <Pressable
                  key={meal}
                  style={styles.mealRow}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/log', params: { meal } })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{MEAL_LABELS[meal] || meal}</Text>
                    <Text style={styles.mealFood} numberOfLines={1}>
                      {planName}
                    </Text>
                  </View>
                  <Text style={[styles.badge, eaten && styles.badgeOn]}>
                    {eaten ? 'Logged' : 'Log'}
                  </Text>
                </Pressable>
              );
            })}
          </Card>

          <Card>
            <Text style={styles.h}>Nutrition</Text>
            <View style={styles.nutriGrid}>
              {nutrients.map(([key, n]) => (
                <View key={key} style={styles.nutriCell}>
                  <Text style={styles.nutriPct}>{Math.round(n.percent || 0)}%</Text>
                  <Text style={styles.nutriLabel}>{n.name || key}</Text>
                </View>
              ))}
            </View>
            <Button label="Full nutrition" variant="ghost" onPress={() => router.push('/(tabs)/nutrition')} />
          </Card>

          {(data?.alerts || []).length > 0 && (
            <Card>
              <Text style={styles.h}>Alerts</Text>
              {data!.alerts.map((a, i) => (
                <Text key={i} style={styles.alert}>
                  {a.message}
                </Text>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
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
  meta: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  mealName: { fontFamily: 'Nunito_700Bold', color: colors.text },
  mealFood: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 13 },
  badge: {
    fontFamily: 'Nunito_700Bold',
    color: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  badgeOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
    color: colors.white,
  },
  nutriGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutriCell: {
    width: '30%',
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.sm,
    padding: 10,
    alignItems: 'center',
  },
  nutriPct: { fontFamily: 'Nunito_800ExtraBold', color: colors.primary, fontSize: 18 },
  nutriLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  alert: {
    fontFamily: 'Nunito_400Regular',
    color: colors.text,
    marginBottom: 8,
  },
});
