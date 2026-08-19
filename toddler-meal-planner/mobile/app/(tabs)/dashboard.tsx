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
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, MEAL_LABELS, MEAL_ORDER, radii } from '../../src/theme';
import type { DashboardData, Recipe } from '../../src/types';

const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🥣',
  mid_morning_snack: '🍌',
  lunch: '🍲',
  evening_snack: '🍎',
  dinner: '🥗',
};

const GREETING = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardScreen() {
  const { activeToddler, toddlers, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const [d, r] = await Promise.all([
        api.dashboard(activeToddler.ref),
        api.recipes().catch(() => ({ recipes: [] })),
      ]);
      setData(d);
      const list = r.recipes || r || [];
      setRecipes(Array.isArray(list) ? list.slice(0, 6) : []);
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

  const rawSchedule = new Set([
    ...(data?.schedule?.meals || []),
    ...(data?.schedule?.snacks || []),
  ]);
  const schedule = MEAL_ORDER.filter((m) => rawSchedule.has(m));
  const nutrients = Object.entries(data?.nutrition?.nutrients || {}).slice(0, 6);
  const overallPct = Math.round(data?.nutrition?.overall_percent || 0);
  const streak = data?.logging_stats?.current_streak ?? 0;
  const totalLogged = data?.logging_stats?.total_meals_logged ?? 0;
  const mealsLogged = data?.meals_eaten?.length || 0;
  const mealsTotal = schedule.length || 5;
  const firstName = (user?.name || activeToddler?.name || 'there').split(' ')[0];

  return (
    <Screen>
      <AppHeader />
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
          {/* Stats row — matches website .stats-row */}
          <View style={styles.statsRow}>
            <StatCard
              icon="🍽️"
              value={`${mealsLogged}/${mealsTotal}`}
              label="Meals Today"
              gradient={['#6366f1', '#8b5cf6'] as [string, string]}
            />
            <StatCard
              icon="📊"
              value={`${overallPct}%`}
              label="Nutrition"
              gradient={['#22c55e', '#4ade80'] as [string, string]}
            />
            <StatCard
              icon="🔥"
              value={`${streak}`}
              label="Day Streak"
              gradient={['#f97316', '#fb923c'] as [string, string]}
            />
          </View>

          {/* Today's meals — matches website meal-slot style */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's Meals</Text>
              <Text style={styles.cardSubtitle}>
                {GREETING()}, {firstName}!
              </Text>
            </View>
            {schedule.map((meal) => {
              const eaten = data?.meals_eaten?.includes(meal);
              const planMeal = data?.today_plan?.meals?.[meal];
              const planName =
                planMeal?.summary ||
                planMeal?.food?.name ||
                planMeal?.main?.name ||
                'Tap to log';
              const emoji = MEAL_EMOJI[meal] || '🍽️';
              return (
                <Pressable
                  key={meal}
                  style={[styles.mealSlot, eaten && styles.mealSlotDone]}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/log', params: { meal } })
                  }
                >
                  <LinearGradient
                    colors={
                      eaten
                        ? (['#22c55e', '#4ade80'] as [string, string])
                        : (['#6366f1', '#8b5cf6'] as [string, string])
                    }
                    style={styles.mealIcon}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </LinearGradient>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>{MEAL_LABELS[meal] || meal}</Text>
                    <Text style={styles.mealFood} numberOfLines={1}>
                      {planName}
                    </Text>
                  </View>
                  <LinearGradient
                    colors={
                      eaten
                        ? (['#22c55e', '#4ade80'] as [string, string])
                        : (['#6366f1', '#8b5cf6'] as [string, string])
                    }
                    style={styles.mealAction}
                  >
                    <Text style={styles.mealActionText}>
                      {eaten ? '✓ Logged' : 'Log'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>

          {/* Nutrition — matches website nutrient-card + bar */}
          {nutrients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardTitle}>Nutrition</Text>
                <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
                  <Text style={styles.linkText}>See all →</Text>
                </Pressable>
              </View>
              <View style={styles.nutriGrid}>
                {nutrients.map(([key, n]) => {
                  const pct = Math.round(n.percent || 0);
                  const barGrad: [string, string] =
                    pct >= 80
                      ? ['#22c55e', '#a3e635']
                      : pct >= 50
                        ? ['#f97316', '#fbbf24']
                        : ['#f43f5e', '#fda4af'];
                  return (
                    <View key={key} style={styles.nutriCard}>
                      <Text style={styles.nutriLabel}>{n.name || key}</Text>
                      <View style={styles.nutriBarBg}>
                        <LinearGradient
                          colors={barGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.nutriBar, { width: `${Math.min(pct, 100)}%` }]}
                        />
                      </View>
                      <Text style={styles.nutriPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recipes — matches website recipe-card grid */}
          {recipes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardTitle}>Recipe Ideas</Text>
                <Pressable onPress={() => router.push('/recipes')}>
                  <Text style={styles.linkText}>See all →</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {recipes.map((r, i) => {
                  const emojis = ['🥣', '🍲', '🥗', '🍛', '🥘', '🍜'];
                  return (
                    <Pressable
                      key={r.slug}
                      style={styles.recipeCard}
                      onPress={() => router.push(`/recipe/${r.slug}`)}
                    >
                      <LinearGradient
                        colors={['#f3e8ff', '#ffffff'] as [string, string]}
                        style={styles.recipeInner}
                      >
                        <Text style={styles.recipeEmoji}>
                          {emojis[i % emojis.length]}
                        </Text>
                        <Text style={styles.recipeName} numberOfLines={2}>
                          {r.name}
                        </Text>
                        <Text style={styles.recipeCategory}>
                          {r.category || 'Recipe'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Alerts — matches website alert cards */}
          {(data?.alerts || []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.cardTitle}>Alerts</Text>
              {data!.alerts.map((a, i) => {
                const sev = a.severity || a.alert_type || 'info';
                const isCrit = sev === 'critical' || sev === 'high';
                const isWarn = sev === 'warning' || sev === 'medium';
                const bg = isCrit
                  ? 'rgba(239,68,68,0.08)'
                  : isWarn
                    ? 'rgba(234,179,8,0.08)'
                    : 'rgba(59,130,246,0.08)';
                const border = isCrit
                  ? 'rgba(239,68,68,0.3)'
                  : isWarn
                    ? 'rgba(234,179,8,0.3)'
                    : 'rgba(59,130,246,0.3)';
                return (
                  <View
                    key={i}
                    style={[styles.alertCard, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={styles.alertIcon}>
                      {isCrit ? '🔴' : isWarn ? '⚠️' : 'ℹ️'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertText}>{a.message}</Text>
                      {a.recommendation ? (
                        <Text style={styles.alertRec}>{a.recommendation}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              {[
                { emoji: '🍽️', label: 'Log Meal', route: '/(tabs)/log' },
                { emoji: '📅', label: 'Plan', route: '/(tabs)/plan' },
                { emoji: '📖', label: 'Recipes', route: '/recipes' },
                { emoji: '💬', label: 'Ask AI', route: '/chat' },
              ].map((a) => (
                <Pressable
                  key={a.route}
                  style={styles.actionBtn}
                  onPress={() => router.push(a.route as any)}
                >
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

function StatCard({
  icon,
  value,
  label,
  gradient,
}: {
  icon: string;
  value: string;
  label: string;
  gradient: [string, string];
}) {
  return (
    <View style={styles.statCard}>
      <LinearGradient
        colors={[gradient[0] + '26', gradient[1] + '26'] as [string, string]}
        style={styles.statIcon}
      >
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 20 },

  /* Stats row — website: .stats-row grid */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* Section container */
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },

  /* Meal slots — website: .meal-slot */
  mealSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
  },
  mealSlotDone: {
    borderColor: colors.success,
    borderStyle: 'solid',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  mealIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  mealInfo: { flex: 1 },
  mealName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  mealFood: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  mealAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  mealActionText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },

  /* Nutrition — website: .nutrient-card */
  nutriGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutriCard: {
    width: '47%',
    backgroundColor: colors.bgTertiary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  nutriLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  nutriBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    marginBottom: 4,
    overflow: 'hidden',
  },
  nutriBar: {
    height: 10,
    borderRadius: 5,
  },
  nutriPct: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: colors.primary,
  },

  /* Recipe cards — website: .recipe-card */
  recipeCard: {
    width: 150,
    marginRight: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  recipeInner: {
    padding: 16,
    minHeight: 140,
    borderRadius: 24,
  },
  recipeEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  recipeName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  recipeCategory: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
  },

  /* Alerts — website: .alert with severity colors */
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  alertIcon: { fontSize: 16, marginTop: 2 },
  alertText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  alertRec: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },

  /* Quick actions */
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
});
