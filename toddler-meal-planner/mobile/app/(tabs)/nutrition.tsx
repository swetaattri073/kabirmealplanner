import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, NUTRIENTS, PRIORITY_NUTRIENTS, radii } from '../../src/theme';

function statusGrad(pct: number): [string, string] {
  if (pct >= 80) return ['#22c55e', '#a3e635'];
  if (pct >= 50) return ['#f97316', '#fbbf24'];
  return ['#f43f5e', '#fda4af'];
}

function statusLabel(pct: number): string {
  if (pct > 150) return 'Excess';
  if (pct >= 80) return 'Good';
  if (pct >= 50) return 'Moderate';
  return 'Low';
}

export default function NutritionScreen() {
  const { activeToddler } = useAuth();
  const [daily, setDaily] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const [d, a, b] = await Promise.all([
        api.nutritionDaily(activeToddler.ref),
        api.nutritionAlerts(activeToddler.ref).catch(() => ({ alerts: [] })),
        api.nutritionBreakdown(activeToddler.ref).catch(() => null),
      ]);
      setDaily(d);
      setAlerts(a.alerts || a || []);
      setBreakdown(b);
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

  if (!activeToddler) {
    return (
      <Screen>
        <AppHeader title="Nutrition" />
        <EmptyState text="Add a toddler to track nutrition." />
      </Screen>
    );
  }

  const rawNutrients = daily?.nutrients || daily?.status?.nutrients || {};
  const displayKeys = showAll
    ? NUTRIENTS.map((n) => n.key)
    : [...PRIORITY_NUTRIENTS];

  const overallPct = Math.round(daily?.overall_percent || 0);

  return (
    <Screen>
      <AppHeader title="Nutrition" />
      {loading && !daily ? (
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
          {/* Overall score */}
          <Card style={styles.overallCard}>
            <Text style={styles.overallLabel}>Today's Nutrition Score</Text>
            <Text style={styles.overallPct}>{overallPct}%</Text>
            <View style={styles.overallBarBg}>
              <LinearGradient
                colors={statusGrad(overallPct)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.overallBar, { width: `${Math.min(overallPct, 100)}%` }]}
              />
            </View>
            <Text style={styles.overallStatus}>{statusLabel(overallPct)}</Text>
          </Card>

          {/* Nutrient grid */}
          <View style={styles.sectionHeader}>
            <Text style={styles.h}>Nutrients</Text>
            <Pressable onPress={() => setShowAll(!showAll)}>
              <Text style={styles.toggleLink}>
                {showAll ? 'Show priority' : 'Show all 14'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.nutriGrid}>
            {displayKeys.map((key) => {
              const meta = NUTRIENTS.find((n) => n.key === key);
              const n = rawNutrients[key] || {};
              const pct = Math.min(Math.round(n.percent || 0), 200);
              const displayPct = Math.min(pct, 100);
              const consumed = n.consumed ?? 0;
              const target = n.target ?? 0;
              const grad = statusGrad(pct);
              const suggestions = n.suggestions || n.try_including || [];

              return (
                <View key={key} style={styles.nutriCard}>
                  <View style={styles.nutriHeader}>
                    <Text style={styles.nutriIcon}>{meta?.icon || '📊'}</Text>
                    <Text style={styles.nutriName}>{meta?.name || n.name || key}</Text>
                  </View>
                  <View style={styles.nutriBarBg}>
                    <LinearGradient
                      colors={grad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.nutriBar, { width: `${displayPct}%` }]}
                    />
                  </View>
                  <View style={styles.nutriValues}>
                    <Text style={styles.nutriPct}>{pct}%</Text>
                    <Text style={styles.nutriAmount}>
                      {Math.round(consumed * 10) / 10}{meta?.unit || n.unit || ''} / {Math.round(target * 10) / 10}
                    </Text>
                  </View>
                  <Text style={[styles.nutriStatus, { color: grad[0] }]}>
                    {statusLabel(pct)}
                  </Text>
                  {pct < 80 && suggestions.length > 0 && (
                    <Text style={styles.nutriSuggestion}>
                      Try: {suggestions.slice(0, 3).join(', ')}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Alerts */}
          <Text style={styles.h}>Nutrition Alerts</Text>
          {alerts.length > 0 ? (
            alerts.map((a: any, i: number) => {
              const sev = a.severity || 'info';
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
                <View key={i} style={[styles.alertCard, { backgroundColor: bg, borderColor: border }]}>
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
            })
          ) : (
            <Card>
              <Text style={styles.noAlerts}>
                No nutrition alerts right now. Keep logging meals to track your toddler's nutrition!
              </Text>
            </Card>
          )}

          {/* Breakdown items */}
          {breakdown?.items && breakdown.items.length > 0 && (
            <>
              <Text style={styles.h}>Today's Food Breakdown</Text>
              {breakdown.items.map((item: any, i: number) => (
                <Card key={i} style={styles.breakdownCard}>
                  <Text style={styles.breakdownFood}>{item.food_name || 'Food'}</Text>
                  <Text style={styles.breakdownMeal}>
                    {item.meal_type ? (item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)).replace(/_/g, ' ') : ''} · {item.portion_percent || 100}% eaten
                  </Text>
                  <View style={styles.nutriChips}>
                    {item.calories != null && (
                      <Text style={styles.nutriChip}>🔥 {Math.round(item.calories)} kcal</Text>
                    )}
                    {item.protein_g != null && (
                      <Text style={styles.nutriChip}>💪 {Math.round(item.protein_g * 10) / 10}g</Text>
                    )}
                    {item.iron_mg != null && (
                      <Text style={styles.nutriChip}>🩸 {Math.round(item.iron_mg * 10) / 10}mg</Text>
                    )}
                    {item.calcium_mg != null && (
                      <Text style={styles.nutriChip}>🦴 {Math.round(item.calcium_mg)}mg</Text>
                    )}
                  </View>
                </Card>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
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
    marginBottom: 12,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  toggleLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  overallCard: {
    alignItems: 'center',
    padding: 20,
  },
  overallLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  overallPct: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    color: colors.primary,
  },
  overallBarBg: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    marginTop: 8,
    overflow: 'hidden',
  },
  overallBar: {
    height: 12,
    borderRadius: 6,
  },
  overallStatus: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
  },
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
  nutriHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  nutriIcon: { fontSize: 16 },
  nutriName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  nutriBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 6,
  },
  nutriBar: {
    height: 8,
    borderRadius: 4,
  },
  nutriValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutriPct: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: colors.primary,
  },
  nutriAmount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: colors.textMuted,
  },
  nutriStatus: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    marginTop: 2,
  },
  nutriSuggestion: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
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
  noAlerts: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  breakdownCard: {
    marginBottom: 8,
  },
  breakdownFood: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  breakdownMeal: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  nutriChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nutriChip: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.bgTertiary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
