import React, { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [selectedNutrient, setSelectedNutrient] = useState<string | null>(null);
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<number | null>(null);

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

  const rawNutrients = daily?.nutrition || daily?.nutrients || daily?.status?.nutrients || {};
  const displayKeys = showAll
    ? NUTRIENTS.map((n) => n.key)
    : [...PRIORITY_NUTRIENTS];

  const nutrientValues = Object.values(rawNutrients) as any[];
  const overallPct = nutrientValues.length > 0
    ? Math.round(nutrientValues.reduce((s: number, n: any) => s + (n.percentage || n.percent || 0), 0) / nutrientValues.length)
    : 0;

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
              const pct = Math.min(Math.round(n.percent || n.percentage || 0), 200);
              const displayPct = Math.min(pct, 100);
              const consumed = n.consumed ?? n.actual ?? 0;
              const target = n.target ?? n.rda ?? 0;
              const grad = statusGrad(pct);
              const rawSuggestions = n.include_examples || n.suggestions || n.try_including || [];
              const suggestionNames = rawSuggestions
                .map((s: any) => (typeof s === 'string' ? s : s?.name || ''))
                .filter(Boolean);

              return (
                <Pressable key={key} onPress={() => setSelectedNutrient(key)} style={styles.nutriCard}>
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
                  {pct < 80 && suggestionNames.length > 0 && (
                    <Text style={styles.nutriSuggestion}>
                      Try: {suggestionNames.slice(0, 3).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.tapHint}>Tap for details</Text>
                </Pressable>
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
              {breakdown.items.map((item: any, i: number) => {
                const n = item.nutrients || {};
                return (
                  <Pressable key={i} onPress={() => setSelectedBreakdownItem(selectedBreakdownItem === i ? null : i)}>
                    <Card style={styles.breakdownCard}>
                      <Text style={styles.breakdownFood}>{item.food_name || 'Food'}</Text>
                      <Text style={styles.breakdownMeal}>
                        {item.meal_type ? (item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)).replace(/_/g, ' ') : ''} · {item.portion_eaten_percent || item.portion_percent || 100}% eaten
                        {item.actual_g ? ` · ${Math.round(item.actual_g)}g` : ''}
                      </Text>
                      <View style={styles.nutriChips}>
                        {n.calories != null && (
                          <Text style={styles.nutriChip}>🔥 {Math.round(n.calories)} kcal</Text>
                        )}
                        {n.protein_g != null && (
                          <Text style={styles.nutriChip}>💪 {Math.round(n.protein_g * 10) / 10}g</Text>
                        )}
                        {n.iron_mg != null && (
                          <Text style={styles.nutriChip}>🩸 {Math.round(n.iron_mg * 10) / 10}mg</Text>
                        )}
                        {n.calcium_mg != null && (
                          <Text style={styles.nutriChip}>🦴 {Math.round(n.calcium_mg)}mg</Text>
                        )}
                      </View>
                      {selectedBreakdownItem === i && (
                        <View style={styles.expandedNutri}>
                          {Object.entries(n).map(([nk, nv]: [string, any]) => {
                            const nmeta = NUTRIENTS.find((x) => x.key === nk);
                            if (!nmeta || nv == null || nv === 0) return null;
                            return (
                              <View key={nk} style={styles.expandedRow}>
                                <Text style={styles.expandedIcon}>{nmeta.icon}</Text>
                                <Text style={styles.expandedName}>{nmeta.name}</Text>
                                <Text style={styles.expandedVal}>{Math.round(nv * 10) / 10} {nmeta.unit}</Text>
                              </View>
                            );
                          })}
                          {item.formula && (
                            <Text style={styles.formulaText}>{item.formula}</Text>
                          )}
                        </View>
                      )}
                    </Card>
                  </Pressable>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Nutrient detail modal */}
      <Modal
        visible={!!selectedNutrient}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedNutrient(null)}
      >
        <NutrientDetailModal
          nutrientKey={selectedNutrient}
          breakdown={breakdown}
          rawNutrients={rawNutrients}
          onClose={() => setSelectedNutrient(null)}
        />
      </Modal>
    </Screen>
  );
}

function NutrientDetailModal({
  nutrientKey,
  breakdown,
  rawNutrients,
  onClose,
}: {
  nutrientKey: string | null;
  breakdown: any;
  rawNutrients: any;
  onClose: () => void;
}) {
  if (!nutrientKey) return null;

  const meta = NUTRIENTS.find((n) => n.key === nutrientKey);
  const n = rawNutrients[nutrientKey] || {};
  const pct = Math.round(n.percent || n.percentage || 0);
  const consumed = n.consumed ?? n.actual ?? 0;
  const target = n.target ?? n.rda ?? 0;
  const grad = statusGrad(pct);

  const items: Array<{ food_name: string; value: number; portion: number; meal_type: string }> = [];
  if (breakdown?.items) {
    for (const item of breakdown.items) {
      const nutrients = item.nutrients || {};
      const val = nutrients[nutrientKey] ?? item[nutrientKey];
      if (val != null && val > 0) {
        items.push({
          food_name: item.food_name || 'Food',
          value: val,
          portion: item.portion_eaten_percent || item.portion_percent || 100,
          meal_type: item.meal_type || '',
        });
      }
    }
  }
  items.sort((a, b) => b.value - a.value);

  const totalFromItems = items.reduce((s, i) => s + i.value, 0);

  return (
    <View style={modalStyles.overlay}>
      <View style={modalStyles.sheet}>
        <View style={modalStyles.header}>
          <View style={modalStyles.headerLeft}>
            <Text style={modalStyles.headerIcon}>{meta?.icon || '📊'}</Text>
            <Text style={modalStyles.headerTitle}>{meta?.name || nutrientKey}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={modalStyles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        <View style={modalStyles.summaryRow}>
          <View style={modalStyles.summaryItem}>
            <Text style={modalStyles.summaryValue}>{Math.round(consumed * 10) / 10}</Text>
            <Text style={modalStyles.summaryUnit}>{meta?.unit || ''} consumed</Text>
          </View>
          <View style={modalStyles.summaryItem}>
            <Text style={modalStyles.summaryValue}>{Math.round(target * 10) / 10}</Text>
            <Text style={modalStyles.summaryUnit}>{meta?.unit || ''} target</Text>
          </View>
          <View style={modalStyles.summaryItem}>
            <Text style={[modalStyles.summaryValue, { color: grad[0] }]}>{pct}%</Text>
            <Text style={modalStyles.summaryUnit}>{statusLabel(pct)}</Text>
          </View>
        </View>

        <Text style={modalStyles.sectionTitle}>
          Foods contributing to {meta?.name || nutrientKey} today
        </Text>

        <ScrollView style={modalStyles.list}>
          {items.length > 0 ? (
            items.map((item, i) => {
              const share = totalFromItems > 0 ? Math.round((item.value / totalFromItems) * 100) : 0;
              return (
                <View key={i} style={modalStyles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.foodName}>{item.food_name}</Text>
                    <Text style={modalStyles.foodMeal}>
                      {(item.meal_type || '').replace(/_/g, ' ')} · {item.portion}% eaten
                    </Text>
                  </View>
                  <View style={modalStyles.foodRight}>
                    <Text style={modalStyles.foodValue}>
                      {Math.round(item.value * 10) / 10} {meta?.unit || ''}
                    </Text>
                    <Text style={modalStyles.foodShare}>{share}%</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={modalStyles.emptyState}>
              <Text style={modalStyles.emptyIcon}>🍽️</Text>
              <Text style={modalStyles.emptyText}>
                No foods logged today contribute to {meta?.name || nutrientKey}.
              </Text>
              <Text style={modalStyles.emptyHint}>
                Log a meal to see which foods provide this nutrient.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: { fontSize: 22 },
  headerTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textMuted,
    fontFamily: 'Nunito_700Bold',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.text,
  },
  summaryUnit: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 18,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  foodName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  foodMeal: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  foodRight: {
    alignItems: 'flex-end',
  },
  foodValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: colors.primary,
  },
  foodShare: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});

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
  tapHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
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
  expandedNutri: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  expandedIcon: { fontSize: 14, width: 20 },
  expandedName: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  expandedVal: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  formulaText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
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
