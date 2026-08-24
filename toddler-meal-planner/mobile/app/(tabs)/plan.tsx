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

  // ISO dates ("2026-08-17") are hard to read at a glance; spelled-out days are not.
  const formatWeek = (start: string, end: string) => {
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    };
    return `This week: ${fmt(start)} to ${fmt(end)}`;
  };

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

  // This replaces the whole week's meals and sat one stray tap away at the top
  // of the screen, so it now asks first and names the child it affects.
  const confirmRegenerate = useCallback(() => {
    Alert.alert(
      'Make a new plan?',
      `This changes the meals planned for ${activeToddler?.name || 'your child'} this week. Meals you have already logged are kept.`,
      // Android renders these bottom-up, so the destructive option is listed
      // first in order to appear second on screen.
      [
        { text: 'Yes, make a new plan', onPress: () => load(true) },
        { text: 'No, keep this plan', style: 'cancel' },
      ],
    );
  }, [activeToddler, load]);

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
                {formatWeek(plan.week_start, plan.week_end)}
              </Text>
            </View>
          )}

          <Button
            label={regenerating ? 'Making a new plan...' : 'Make a new plan'}
            variant="secondary"
            onPress={confirmRegenerate}
            loading={regenerating}
            disabled={regenerating}
          />

          {/* Under 12 months the same dish needs different preparation, so the
              plan leads with the stage rather than leaving it to be guessed. */}
          {plan?.weaning && (
            <Pressable
              style={styles.weaningCard}
              onPress={() => router.push('/weaning')}
              accessibilityRole="button"
              accessibilityLabel={`${plan.weaning.stage_title}. Tap to open the starting solids guide.`}
            >
              <Text style={styles.weaningStage}>{plan.weaning.stage_title}</Text>
              <Text style={styles.weaningPrep}>{plan.weaning.prep_note}</Text>
              <Text style={styles.weaningMilk}>{plan.weaning.milk_note}</Text>
              <Text style={styles.weaningLink}>Open the starting solids guide →</Text>
            </Pressable>
          )}

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
            <EmptyState text="No meals planned yet. Tap 'Make a new plan' above to get started." />
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
    fontSize: 15,
    color: colors.textSecondary,
  },
  weaningCard: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.primary,
    padding: 16,
    marginTop: 12,
  },
  weaningStage: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.text,
    marginBottom: 6,
  },
  weaningPrep: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: colors.text,
    lineHeight: 23,
    marginBottom: 6,
  },
  weaningMilk: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 8,
  },
  weaningLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.primary,
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
