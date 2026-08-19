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
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, MEAL_EMOJI, MEAL_LABELS, MEAL_ORDER, radii } from '../../src/theme';

export default function PlanScreen() {
  const { activeToddler } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (regenerate = false) => {
      if (!activeToddler) {
        setLoading(false);
        return;
      }
      if (regenerate) setRegenerating(true);
      try {
        const data = await api.weeklyPlan(activeToddler.ref, undefined, regenerate);
        setPlan(data);
      } catch (e: any) {
        Alert.alert(
          'Plan error',
          e?.message || e?.body?.error || 'Could not load plan. Make sure you are logged in.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setRegenerating(false);
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
          {/* Week header */}
          {plan?.week_start && (
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>
                Week of {plan.week_start} to {plan.week_end}
              </Text>
            </View>
          )}

          <Button
            label={regenerating ? 'Regenerating...' : 'Regenerate plan'}
            variant="secondary"
            onPress={() => load(true)}
            loading={regenerating}
            disabled={regenerating}
          />

          {days.map((day: any) => {
            const isToday =
              day.date === new Date().toISOString().split('T')[0];
            return (
              <Card
                key={day.date || day.day_of_week}
                style={isToday ? styles.todayCard : undefined}
              >
                <View style={styles.dayHeader}>
                  <Text style={[styles.day, isToday && styles.dayToday]}>
                    {day.day_name || day.weekday || day.date}
                  </Text>
                  {isToday && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Today</Text>
                    </View>
                  )}
                </View>
                {MEAL_ORDER.map((meal) => {
                  const info = (day.meals || {})[meal] as any;
                  if (!info) return null;
                  const name =
                    info?.summary ||
                    info?.food?.name ||
                    info?.main?.name ||
                    info?.display_name ||
                    info?.name ||
                    '—';
                  const addIns = info?.add_ins || [];
                  const recipeSlug = info?.recipe_slug;
                  const emoji = MEAL_EMOJI[meal] || '🍽️';

                  return (
                    <Pressable
                      key={meal}
                      style={styles.mealRow}
                      onPress={() =>
                        router.push({ pathname: '/(tabs)/log', params: { meal } })
                      }
                    >
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6'] as [string, string]}
                        style={styles.mealIcon}
                      >
                        <Text style={{ fontSize: 16 }}>{emoji}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealLabel}>{MEAL_LABELS[meal] || meal}</Text>
                        <Text style={styles.mealFood} numberOfLines={2}>
                          {name}
                        </Text>
                        {addIns.length > 0 && (
                          <View style={styles.addInsRow}>
                            {addIns.map((a: any, i: number) => (
                              <Text key={i} style={styles.addInChip}>
                                🥬 {a.name || a.label || a}
                              </Text>
                            ))}
                          </View>
                        )}
                        {recipeSlug && (
                          <Pressable
                            onPress={() => router.push(`/recipe/${recipeSlug}`)}
                            hitSlop={8}
                          >
                            <Text style={styles.recipeLink}>📖 View recipe</Text>
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            );
          })}
          {!days.length && !loading ? (
            <EmptyState text="No plan generated yet. Tap Regenerate to create one." />
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  weekHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  weekLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  todayCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  day: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
  },
  dayToday: {
    color: colors.primary,
  },
  todayBadge: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todayBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: colors.white,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mealLabel: {
    fontFamily: 'Nunito_700Bold',
    color: colors.primary,
    fontSize: 13,
  },
  mealFood: {
    fontFamily: 'Nunito_400Regular',
    color: colors.text,
    fontSize: 14,
    marginTop: 2,
  },
  addInsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  addInChip: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  recipeLink: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
});
