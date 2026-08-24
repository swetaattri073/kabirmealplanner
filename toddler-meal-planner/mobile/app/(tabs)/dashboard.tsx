import React, { useCallback, useEffect, useState } from 'react';
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
import { WeaningHomeBanner } from '../../src/components/WeaningHomeBanner';
import { NotificationPromptCard } from '../../src/components/NotificationPromptCard';
import { Button, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { getSeenWeaningIntro, setSeenWeaningIntro } from '../../src/storage';
import { colors, MEAL_EMOJI, MEAL_LABELS, MEAL_ORDER, PRIORITY_NUTRIENTS, NUTRIENTS, radii } from '../../src/theme';
import type { DashboardData, Recipe } from '../../src/types';

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
  const [weeklyNutrition, setWeeklyNutrition] = useState<any>(null);
  const [weeklyAlerts, setWeeklyAlerts] = useState<any[]>([]);
  const [weaning, setWeaning] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; logId?: number; meal?: string } | null>(null);
  const [quickLogging, setQuickLogging] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const isWeaningAge = (activeToddler.age_months ?? 99) < 12;
      const [d, r, wn, wa, w] = await Promise.all([
        api.dashboard(activeToddler.ref),
        api.recipes({ age_months: activeToddler.age_months }).catch(() => ({ recipes: [] })),
        api.nutritionWeekly(activeToddler.ref).catch(() => null),
        api.nutritionAlerts(activeToddler.ref).catch(() => ({ alerts: [] })),
        isWeaningAge
          ? api.weaning(activeToddler.ref).catch(() => null)
          : Promise.resolve(null),
      ]);
      setData(d);
      const list = r.recipes || r || [];
      setRecipes(Array.isArray(list) ? list : []);
      setWeeklyNutrition(wn);
      setWeeklyAlerts(wa?.alerts || wa || []);
      setWeaning(w);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeToddler]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!activeToddler || !data?.today_plan) return;
    const age = activeToddler.age_months ?? 99;
    if (age >= 12) return;
    getSeenWeaningIntro().then((seen) => {
      if (!seen) {
        setSeenWeaningIntro().then(() => router.push('/weaning'));
      }
    });
  }, [activeToddler, data?.today_plan, router]);

  const quickLog = async (meal: string, planMeal: any) => {
    if (!activeToddler) return;
    const foodId = planMeal?.food?.id || planMeal?.main?.id;
    if (!foodId) {
      router.push({ pathname: '/(tabs)/log', params: { meal } });
      return;
    }
    setQuickLogging(meal);
    try {
      const res = await api.createMealLog({
        toddler_ref: activeToddler.ref,
        meal_type: meal,
        food_id: foodId,
        toddler_reaction: 'liked',
        portion_eaten_percent: 100,
        replace_existing: true,
      });
      const logId = Array.isArray(res) ? res[0]?.id : res?.id;
      setToast({
        message: `${MEAL_LABELS[meal] || meal} logged`,
        logId,
        meal,
      });
      await load();
    } catch (e: any) {
      router.push({ pathname: '/(tabs)/log', params: { meal } });
    } finally {
      setQuickLogging(null);
    }
  };

  const undoQuickLog = async () => {
    if (!toast?.logId) {
      setToast(null);
      return;
    }
    try {
      await api.deleteMealLog(toast.logId);
      setToast(null);
      await load();
    } catch {
      setToast(null);
    }
  };

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
  const rawNutri = data?.nutrition || {};
  const nutrients = Object.entries(rawNutri).filter(([k]) => !['toddler_id', 'date', 'age_months'].includes(k)).slice(0, 8);
  const nutriVals = Object.values(rawNutri).filter((v: any) => typeof v === 'object' && v?.percentage != null) as any[];
  const overallPct = nutriVals.length > 0
    ? Math.round(nutriVals.reduce((s: number, n: any) => s + (n.percentage || 0), 0) / nutriVals.length)
    : 0;
  const streak = data?.logging_stats?.current_streak ?? 0;
  const mealsLogged = data?.meals_eaten?.length || 0;
  const mealsTotal = schedule.length || 5;
  const firstName = (user?.name || activeToddler?.name || 'there').split(' ')[0];
  const weeklyPct = Math.round(weeklyNutrition?.overall_percent || weeklyNutrition?.average_percent || 0);
  const alertCount = weeklyAlerts.length;
  const showWeaningBanner = (activeToddler?.age_months ?? 99) < 12;

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
          {/* Greeting */}
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{GREETING()}, {firstName}!</Text>
            <Text style={styles.greetingSub}>
              {activeToddler?.name} · {activeToddler?.age_months} months
            </Text>
          </View>

          {showWeaningBanner && (
            <WeaningHomeBanner
              childName={activeToddler?.name || 'your baby'}
              stageTitle={weaning?.stage?.title}
              nextFood={weaning?.next_food?.name}
              triedCount={weaning?.tried_count}
              totalFoods={weaning?.total_foods}
              onPress={() => router.push('/weaning')}
            />
          )}

          <NotificationPromptCard />

          {/* Horizontal stat cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <StatCard
              icon="🍽️"
              value={`${mealsLogged}/${mealsTotal}`}
              label="Meals Today"
              gradient={['#6366f1', '#8b5cf6'] as [string, string]}
            />
            <StatCard
              icon="📊"
              value={`${overallPct}%`}
              label="Today Nutrition"
              gradient={['#22c55e', '#4ade80'] as [string, string]}
            />
            <StatCard
              icon="📈"
              value={`${weeklyPct}%`}
              label="Weekly Nutrition"
              gradient={['#3b82f6', '#60a5fa'] as [string, string]}
            />
            <StatCard
              icon="🔥"
              value={`${streak}`}
              label="Day Streak"
              gradient={['#f97316', '#fb923c'] as [string, string]}
            />
            <StatCard
              icon="⚠️"
              value={`${alertCount}`}
              label="Alerts"
              gradient={alertCount > 0 ? ['#ef4444', '#f87171'] as [string, string] : ['#22c55e', '#4ade80'] as [string, string]}
            />
          </ScrollView>

          {/* Weekly nutrition summary */}
          {weeklyNutrition && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardTitle}>Weekly Nutrition</Text>
                <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
                  <Text style={styles.linkText}>Details →</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {PRIORITY_NUTRIENTS.slice(0, 6).map((key) => {
                  const wkData = weeklyNutrition?.nutrients?.[key] || weeklyNutrition?.averages?.[key] || {};
                  const pct = Math.round(wkData.percent || wkData.average_percent || 0);
                  const meta = NUTRIENTS.find((n) => n.key === key);
                  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f97316' : '#ef4444';
                  return (
                    <View key={key} style={styles.weekNutriCard}>
                      <Text style={styles.weekNutriIcon}>{meta?.icon || '📊'}</Text>
                      <Text style={styles.weekNutriName}>{meta?.name || key}</Text>
                      <View style={styles.weekNutriBarBg}>
                        <View style={[styles.weekNutriBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.weekNutriPct, { color: barColor }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Weekly alerts */}
          {weeklyAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.cardTitle}>Alerts</Text>
              {weeklyAlerts.slice(0, 3).map((a: any, i: number) => {
                const sev = a.severity || 'info';
                const isCrit = sev === 'critical' || sev === 'high';
                const isWarn = sev === 'warning' || sev === 'medium';
                const bg = isCrit ? 'rgba(239,68,68,0.08)' : isWarn ? 'rgba(234,179,8,0.08)' : 'rgba(59,130,246,0.08)';
                const border = isCrit ? 'rgba(239,68,68,0.3)' : isWarn ? 'rgba(234,179,8,0.3)' : 'rgba(59,130,246,0.3)';
                return (
                  <View key={i} style={[styles.alertCard, { backgroundColor: bg, borderColor: border }]}>
                    <Text style={styles.alertIcon}>{isCrit ? '🔴' : isWarn ? '⚠️' : 'ℹ️'}</Text>
                    <Text style={styles.alertText}>{a.message}</Text>
                  </View>
                );
              })}
              {weeklyAlerts.length > 3 && (
                <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
                  <Text style={styles.linkText}>+{weeklyAlerts.length - 3} more alerts →</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Today's meals */}
          <View style={styles.section}>
            <Text style={styles.cardTitle}>Today's Meals</Text>
            {schedule.map((meal) => {
              const eaten = data?.meals_eaten?.includes(meal);
              const planMeal = data?.today_plan?.meals?.[meal];
              const planName = planMeal?.summary || planMeal?.food?.name || planMeal?.main?.name || 'Tap to log';
              const emoji = MEAL_EMOJI[meal] || '🍽️';
              const recipeSlug = planMeal?.recipe_slug;
              const matchedRecipe = recipeSlug
                ? recipes.find((r) => r.slug === recipeSlug)
                : recipes.find((r) =>
                    r.name.toLowerCase() === (planMeal?.food?.name || planMeal?.main?.name || '').toLowerCase()
                  );
              const coverImg = matchedRecipe?.cover_image_path || matchedRecipe?.cover_url || planMeal?.cover_image_path;
              return (
                <View key={meal} style={[styles.mealSlot, eaten && styles.mealSlotDone]}>
                  <Pressable
                    style={styles.mealTapArea}
                    onPress={() => router.push({ pathname: '/(tabs)/log', params: { meal } })}
                  >
                    {coverImg ? (
                      <Image source={{ uri: coverImg }} style={styles.mealImage} resizeMode="cover" />
                    ) : (
                      <LinearGradient
                        colors={eaten ? (['#22c55e', '#4ade80'] as [string, string]) : (['#6366f1', '#8b5cf6'] as [string, string])}
                        style={styles.mealIcon}
                      >
                        <Text style={{ fontSize: 22 }}>{emoji}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>{MEAL_LABELS[meal] || meal}</Text>
                      <Text style={styles.mealFood} numberOfLines={1}>{planName}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => !eaten && quickLog(meal, planMeal)}
                    disabled={eaten || quickLogging === meal}
                  >
                    <LinearGradient
                      colors={eaten ? (['#22c55e', '#4ade80'] as [string, string]) : (['#6366f1', '#8b5cf6'] as [string, string])}
                      style={styles.mealAction}
                    >
                      <Text style={styles.mealActionText}>
                        {eaten ? '✓ Logged' : quickLogging === meal ? '…' : 'Log'}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Recipes */}
          {recipes.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardTitle}>Recipe Ideas</Text>
                <Pressable onPress={() => router.push('/recipes')}>
                  <Text style={styles.linkText}>See all →</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                {recipes.slice(0, 6).map((r, i) => {
                  const emojis = ['🥣', '🍲', '🥗', '🍛', '🥘', '🍜'];
                  return (
                    <Pressable key={r.slug} style={styles.recipeCard} onPress={() => router.push(`/recipe/${r.slug}`)}>
                      <LinearGradient colors={['#f3e8ff', '#ffffff'] as [string, string]} style={styles.recipeInner}>
                        {(r.cover_image_path || r.cover_url) ? (
                          <Image source={{ uri: r.cover_image_path || r.cover_url || '' }} style={styles.recipeCover} resizeMode="cover" />
                        ) : (
                          <Text style={styles.recipeEmoji}>{emojis[i % emojis.length]}</Text>
                        )}
                        <Text style={styles.recipeName} numberOfLines={2}>{r.name}</Text>
                        <Text style={styles.recipeCategory}>{r.category || 'Recipe'}</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : showWeaningBanner ? (
            <View style={styles.section}>
              <Text style={styles.cardTitle}>Recipe Ideas</Text>
              <Text style={styles.weaningRecipeHint}>
                Age-appropriate recipes will appear here as your baby grows. For now, follow the starting solids guide.
              </Text>
              <Button label="Open starting solids guide" onPress={() => router.push('/weaning')} />
            </View>
          ) : null}

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
                <Pressable key={a.route} style={styles.actionBtn} onPress={() => router.push(a.route as any)}>
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ height: 88 }} />
        </ScrollView>
      )}

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
          {toast.logId ? (
            <Pressable onPress={undoQuickLog}>
              <Text style={styles.toastUndo}>Undo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function StatCard({ icon, value, label, gradient }: { icon: string; value: string; label: string; gradient: [string, string] }) {
  return (
    <View style={styles.statCard}>
      <LinearGradient colors={[gradient[0] + '26', gradient[1] + '26'] as [string, string]} style={styles.statIcon}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weaningRecipeHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  scrollContent: { paddingBottom: 20 },
  greetingRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  greeting: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.text,
  },
  greetingSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  statsScroll: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  statCard: {
    width: 120,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.text,
    marginBottom: 2,
  },
  linkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  weekNutriCard: {
    width: 100,
    backgroundColor: colors.bgTertiary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  weekNutriIcon: { fontSize: 16, marginBottom: 4 },
  weekNutriName: { fontFamily: 'Nunito_600SemiBold', fontSize: 10, color: colors.textSecondary, marginBottom: 6, textAlign: 'center' },
  weekNutriBarBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb', marginBottom: 4, overflow: 'hidden' },
  weekNutriBar: { height: 6, borderRadius: 3 },
  weekNutriPct: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  alertIcon: { fontSize: 14, marginTop: 1 },
  alertText: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 },
  mealSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mealSlotDone: {
    borderColor: colors.success,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  mealTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: colors.text,
    borderRadius: radii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
  },
  toastText: { fontFamily: 'Nunito_600SemiBold', color: colors.white, fontSize: 15, flex: 1 },
  toastUndo: { fontFamily: 'Nunito_800ExtraBold', color: '#fbbf24', fontSize: 15, marginLeft: 12 },
  mealImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  mealIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: { flex: 1 },
  mealName: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.text },
  mealFood: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  mealAction: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  mealActionText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#ffffff' },
  recipeCard: { width: 150, marginRight: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  recipeInner: { padding: 14, minHeight: 130, borderRadius: 20 },
  recipeCover: { width: '100%', height: 70, borderRadius: 10, marginBottom: 6 },
  recipeEmoji: { fontSize: 32, marginBottom: 8 },
  recipeName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.text, marginBottom: 4 },
  recipeCategory: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: colors.primary, textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, alignItems: 'center', gap: 4 },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: colors.text, textAlign: 'center' },
});
