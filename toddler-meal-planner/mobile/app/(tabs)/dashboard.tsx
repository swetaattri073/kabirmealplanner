import React, { useCallback, useState } from 'react';
import {
  Image,
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
import { colors, MEAL_LABELS, radii } from '../../src/theme';
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
      setRecipes(Array.isArray(list) ? list.slice(0, 4) : []);
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
  const overallPct = Math.round(data?.nutrition?.overall_percent || 0);
  const streak = data?.logging_stats?.current_streak ?? 0;
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
          {/* Greeting banner */}
          <LinearGradient
            colors={['#6366f1', '#8b5cf6'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <Text style={styles.greeting}>{GREETING()}, {firstName}!</Text>
            <Text style={styles.bannerSub}>
              {activeToddler?.name} is {activeToddler?.age_months} months old
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{mealsLogged}/{mealsTotal}</Text>
                <Text style={styles.statLabel}>meals logged</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{overallPct}%</Text>
                <Text style={styles.statLabel}>nutrition</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{streak}</Text>
                <Text style={styles.statLabel}>day streak</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Today's meals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
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
                  style={styles.mealCard}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/log', params: { meal } })
                  }
                >
                  <View style={styles.mealEmoji}>
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </View>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>{MEAL_LABELS[meal] || meal}</Text>
                    <Text style={styles.mealFood} numberOfLines={1}>
                      {planName}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, eaten && styles.statusBadgeDone]}>
                    <Text style={[styles.statusText, eaten && styles.statusTextDone]}>
                      {eaten ? '✓' : 'Log'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Nutrition overview */}
          {nutrients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Nutrition</Text>
                <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.nutriGrid}>
                {nutrients.map(([key, n]) => {
                  const pct = Math.round(n.percent || 0);
                  const barColor = pct >= 80 ? colors.success : pct >= 50 ? colors.warning : colors.danger;
                  return (
                    <View key={key} style={styles.nutriCard}>
                      <Text style={styles.nutriName}>{n.name || key}</Text>
                      <View style={styles.nutriBarBg}>
                        <View style={[styles.nutriBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.nutriPct, { color: barColor }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recipe suggestions */}
          {recipes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recipe Ideas</Text>
                <Pressable onPress={() => router.push('/recipes')}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {recipes.map((r, i) => {
                  const bgColors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#ede9fe', '#fee2e2'];
                  const emojis = ['🥣', '🍲', '🥗', '🍛', '🥘', '🍜'];
                  return (
                    <Pressable
                      key={r.slug}
                      style={[styles.recipeCard, { backgroundColor: bgColors[i % bgColors.length] }]}
                      onPress={() => router.push(`/recipe/${r.slug}`)}
                    >
                      <Text style={styles.recipeEmoji}>{emojis[i % emojis.length]}</Text>
                      <Text style={styles.recipeName} numberOfLines={2}>{r.name}</Text>
                      <Text style={styles.recipeCategory}>{r.category || 'Recipe'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Alerts */}
          {(data?.alerts || []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              {data!.alerts.map((a, i) => (
                <View key={i} style={styles.alertCard}>
                  <Text style={styles.alertIcon}>⚠️</Text>
                  <Text style={styles.alertText}>{a.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/log')}>
                <Text style={styles.actionEmoji}>🍽️</Text>
                <Text style={styles.actionLabel}>Log Meal</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/plan')}>
                <Text style={styles.actionEmoji}>📅</Text>
                <Text style={styles.actionLabel}>Meal Plan</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => router.push('/recipes')}>
                <Text style={styles.actionEmoji}>📖</Text>
                <Text style={styles.actionLabel}>Recipes</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => router.push('/chat')}>
                <Text style={styles.actionEmoji}>💬</Text>
                <Text style={styles.actionLabel}>Ask AI</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 20 },
  banner: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 2,
  },
  bannerSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.sm,
    padding: 10,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: '#ffffff',
  },
  statLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  seeAll: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
    marginBottom: 12,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  mealEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  statusBadgeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  statusText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  statusTextDone: {
    color: '#ffffff',
  },
  nutriGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nutriCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  nutriName: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  nutriBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f3f4f6',
    marginBottom: 4,
  },
  nutriBar: {
    height: 6,
    borderRadius: 3,
  },
  nutriPct: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
  },
  recipeCard: {
    width: 140,
    borderRadius: radii.md,
    padding: 14,
    marginHorizontal: 4,
    minHeight: 130,
  },
  recipeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  recipeName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  recipeCategory: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  alertIcon: { fontSize: 16 },
  alertText: {
    fontFamily: 'Nunito_400Regular',
    color: '#92400e',
    flex: 1,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
});
