import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import {
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  Screen,
} from '../../src/components/ui';
import { colors, HIDDEN_VEGGIES, MEAL_EMOJI, MEAL_LABELS, MEAL_ORDER, radii, REACTIONS } from '../../src/theme';
import type { Food } from '../../src/types';

export default function LogMealScreen() {
  const { activeToddler } = useAuth();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [mealType, setMealType] = useState(params.meal || 'breakfast');
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [portion, setPortion] = useState(100);
  const [reaction, setReaction] = useState<string>('liked');
  const [notes, setNotes] = useState('');
  const [nlp, setNlp] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'search' | 'describe' | 'photo'>('search');
  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [hiddenVeggies, setHiddenVeggies] = useState<Map<string, number>>(new Map());
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.meal) setMealType(String(params.meal));
  }, [params.meal]);

  const loadPlan = useCallback(async () => {
    if (!activeToddler) return;
    try {
      const dash = await api.dashboard(activeToddler.ref);
      setTodayPlan(dash?.today_plan?.meals || {});
      setTodayLogs(dash?.today_logs || []);
    } catch {}
  }, [activeToddler]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const setVeggieQty = (key: string, qty: number) => {
    setHiddenVeggies((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(key);
      else next.set(key, qty);
      return next;
    });
  };

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setFoods([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.foods(q.trim());
      setFoods(Array.isArray(data) ? data.slice(0, 20) : (data.foods || []).slice(0, 20));
    } catch {
      setFoods([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const save = async () => {
    if (!activeToddler) return;
    if (!selected) {
      Alert.alert('Pick a food');
      return;
    }
    setSaving(true);
    try {
      await api.createMealLog({
        toddler_id: activeToddler.ref,
        meal_type: mealType,
        food_id: selected.id,
        toddler_reaction: reaction,
        portion_eaten_percent: portion,
        notes: notes || undefined,
        replace_existing: true,
      });
      Alert.alert('Logged', `${selected.name} saved for ${MEAL_LABELS[mealType] || mealType}`);
      setSelected(null);
      setQuery('');
      setFoods([]);
      setPortion(100);
      setReaction('liked');
      setNotes('');
      loadPlan();
    } catch (e: any) {
      Alert.alert('Could not log', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const logPlanned = async (planMeal: any) => {
    if (!activeToddler) return;
    setSaving(true);
    try {
      const foodId = planMeal?.food?.id || planMeal?.food_id || planMeal?.main?.id;
      if (!foodId) {
        Alert.alert('No food linked', 'Use search to find and log a food.');
        setSaving(false);
        return;
      }
      await api.createMealLog({
        toddler_id: activeToddler.ref,
        meal_type: mealType,
        food_id: foodId,
        toddler_reaction: reaction,
        portion_eaten_percent: portion,
        notes: notes || undefined,
        replace_existing: true,
      });
      Alert.alert('Logged', 'Planned meal logged.');
      loadPlan();
    } catch (e: any) {
      Alert.alert('Could not log', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const smartLog = async () => {
    if (!activeToddler || !nlp.trim()) return;
    setSaving(true);
    try {
      await api.smartLog({ toddler_id: activeToddler.ref, text: nlp.trim() });
      Alert.alert('Logged', 'Meal parsed and saved.');
      setNlp('');
      loadPlan();
    } catch (e: any) {
      Alert.alert('Smart log failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const photoLog = async () => {
    if (!activeToddler) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });
    if (shot.canceled || !shot.assets?.[0]) return;
    setLoading(true);
    try {
      const asset = shot.assets[0];
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: 'meal.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);
      form.append('toddler_id', activeToddler.ref);
      const result = await api.recognizeFood(form);
      Alert.alert(
        'Photo analyzed',
        result?.message ||
          result?.foods?.map((f: any) => f.name).join(', ') ||
          'Review suggestions on the server response.',
      );
      loadPlan();
    } catch (e: any) {
      Alert.alert('Photo log unavailable', e?.message || 'Try typing the meal instead.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeToddler) {
    return (
      <Screen>
        <AppHeader title="Log meal" />
        <EmptyState text="Create a toddler profile first." />
      </Screen>
    );
  }

  const planMeal = todayPlan?.[mealType];
  const planName =
    planMeal?.summary ||
    planMeal?.food?.name ||
    planMeal?.main?.name ||
    null;
  const logged = todayLogs.filter((l: any) => l.meal_type === mealType);
  return (
    <Screen>
      <AppHeader title="Log meal" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
      >
        {/* Meal type selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealChips}>
          {MEAL_ORDER.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMealType(m);
                setSelected(null);
                setQuery('');
                setFoods([]);
              }}
              style={[styles.chip, mealType === m && styles.chipOn]}
            >
              <Text style={styles.chipEmoji}>{MEAL_EMOJI[m] || '🍽️'}</Text>
              <Text style={[styles.chipText, mealType === m && styles.chipTextOn]}>
                {MEAL_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Already logged */}
        {logged.length > 0 && (
          <Card style={styles.loggedCard}>
            <Text style={styles.loggedTitle}>Already logged</Text>
            {logged.map((l: any) => (
              <View key={l.id} style={styles.loggedRow}>
                <Text style={styles.loggedFood}>
                  {l.food?.name || l.custom_food_name || 'Food'}
                </Text>
                <Text style={styles.loggedMeta}>
                  {l.portion_eaten_percent || 100}% · {l.toddler_reaction || 'liked'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Today's recommended plan for this meal */}
        {planName && (
          <Card>
            <View style={styles.planHeader}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6'] as [string, string]}
                style={styles.planIcon}
              >
                <Text style={{ fontSize: 20 }}>{MEAL_EMOJI[mealType] || '🍽️'}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.planLabel}>Recommended</Text>
                <Text style={styles.planName}>{planName}</Text>
              </View>
            </View>

            {/* Portion selector */}
            <Text style={styles.fieldLabel}>Portion eaten</Text>
            <PortionPicker value={portion} onChange={setPortion} />

            {/* Reaction picker */}
            <Text style={styles.fieldLabel}>Reaction</Text>
            <View style={styles.reactionsRow}>
              {REACTIONS.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setReaction(r.id)}
                  style={[styles.reactionBtn, reaction === r.id && styles.reactionBtnOn]}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  <Text style={[styles.reactionLabel, reaction === r.id && styles.reactionLabelOn]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Field
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any observations..."
              multiline
            />

            {/* Hidden veggies */}
            <Text style={styles.fieldLabel}>Add hidden veggies</Text>
            <View style={styles.veggieList}>
              {HIDDEN_VEGGIES.map((v) => {
                const qty = hiddenVeggies.get(v.key) || 0;
                return (
                  <View key={v.key} style={styles.veggieItem}>
                    <View style={styles.veggieInfo}>
                      <Text style={styles.veggieEmoji}>{v.emoji}</Text>
                      <Text style={styles.veggieLabel}>{v.label}</Text>
                    </View>
                    <View style={styles.tbspRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          style={[styles.tbspBtn, qty === n && styles.tbspBtnOn]}
                          onPress={() => setVeggieQty(v.key, qty === n ? 0 : n)}
                        >
                          <Text style={[styles.tbspText, qty === n && styles.tbspTextOn]}>{n}</Text>
                        </Pressable>
                      ))}
                      <Text style={styles.tbspUnit}>tbsp</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Button label="Log this meal" onPress={() => logPlanned(planMeal)} loading={saving} />
            <Button
              label="Ate something else"
              variant="ghost"
              onPress={() => {
                setTab('search');
                scrollRef.current?.scrollToEnd({ animated: true });
              }}
            />
          </Card>
        )}

        {/* Alternate food logging (search / describe / photo) */}
        <Card>
          <Text style={styles.sectionTitle}>
            {planName ? 'Or log a different food' : 'Log a food'}
          </Text>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['search', 'describe', 'photo'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnOn]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                  {t === 'search' ? '🔍 Search' : t === 'describe' ? '✏️ Describe' : '📷 Photo'}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'search' && (
            <>
              <Field
                label="Search food"
                value={query}
                onChangeText={search}
                placeholder="e.g. idli, dal, banana"
              />
              {searching ? <LoadingBlock /> : null}
              {foods.map((f) => (
                <Pressable
                  key={f.id}
                  style={[styles.foodRow, selected?.id === f.id && styles.foodOn]}
                  onPress={() => setSelected(f)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{f.name}</Text>
                    <Text style={styles.foodMeta}>{f.category}</Text>
                    <View style={styles.foodNutriRow}>
                      {f.calories != null && (
                        <Text style={styles.foodNutriChip}>🔥 {Math.round(f.calories)}</Text>
                      )}
                      {f.protein_g != null && (
                        <Text style={styles.foodNutriChip}>💪 {Math.round(f.protein_g * 10) / 10}g</Text>
                      )}
                      {f.iron_mg != null && (
                        <Text style={styles.foodNutriChip}>🩸 {Math.round(f.iron_mg * 10) / 10}mg</Text>
                      )}
                      {f.calcium_mg != null && (
                        <Text style={styles.foodNutriChip}>🦴 {Math.round(f.calcium_mg || 0)}mg</Text>
                      )}
                    </View>
                  </View>
                  {selected?.id === f.id && <Text style={styles.checkMark}>✓</Text>}
                </Pressable>
              ))}

              {selected && (
                <>
                  <Text style={styles.fieldLabel}>Portion eaten</Text>
                  <PortionPicker value={portion} onChange={setPortion} />

                  <Text style={styles.fieldLabel}>Reaction</Text>
                  <View style={styles.reactionsRow}>
                    {REACTIONS.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => setReaction(r.id)}
                        style={[styles.reactionBtn, reaction === r.id && styles.reactionBtnOn]}
                      >
                        <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                        <Text
                          style={[styles.reactionLabel, reaction === r.id && styles.reactionLabelOn]}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Field
                    label="Notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any observations..."
                    multiline
                  />

                  <Text style={styles.fieldLabel}>Hidden veggies</Text>
                  <View style={styles.veggieList}>
                    {HIDDEN_VEGGIES.map((v) => {
                      const qty = hiddenVeggies.get(v.key) || 0;
                      return (
                        <View key={v.key} style={styles.veggieItem}>
                          <View style={styles.veggieInfo}>
                            <Text style={styles.veggieEmoji}>{v.emoji}</Text>
                            <Text style={styles.veggieLabel}>{v.label}</Text>
                          </View>
                          <View style={styles.tbspRow}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Pressable
                                key={n}
                                style={[styles.tbspBtn, qty === n && styles.tbspBtnOn]}
                                onPress={() => setVeggieQty(v.key, qty === n ? 0 : n)}
                              >
                                <Text style={[styles.tbspText, qty === n && styles.tbspTextOn]}>{n}</Text>
                              </Pressable>
                            ))}
                            <Text style={styles.tbspUnit}>tbsp</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <Button label="Save meal" onPress={save} loading={saving} />
                </>
              )}
            </>
          )}

          {tab === 'describe' && (
            <>
              <Field
                label="Describe the meal"
                value={nlp}
                onChangeText={setNlp}
                placeholder="Had rice and dal for lunch, ate half, liked it"
                multiline
              />
              <Button label="Smart log" onPress={smartLog} loading={saving} />
            </>
          )}

          {tab === 'photo' && (
            <>
              <Text style={styles.photoHint}>
                Take a photo of the meal and we'll try to identify the foods.
              </Text>
              <Button label="Open camera" onPress={photoLog} loading={loading} />
            </>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const PORTION_STEPS = [
  { value: 0, label: 'None', short: '0%' },
  { value: 25, label: 'A little', short: '25%' },
  { value: 50, label: 'Half', short: '50%' },
  { value: 75, label: 'Most', short: '75%' },
  { value: 100, label: 'All', short: '100%' },
];

function PortionPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={portionStyles.row}>
      {PORTION_STEPS.map((s) => (
        <Pressable
          key={s.value}
          style={[portionStyles.btn, value === s.value && portionStyles.btnOn]}
          onPress={() => onChange(s.value)}
        >
          <Text style={[portionStyles.label, value === s.value && portionStyles.labelOn]}>
            {s.label}
          </Text>
          <Text style={[portionStyles.pct, value === s.value && portionStyles.labelOn]}>
            {s.short}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const portionStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  btn: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  btnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  pct: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  labelOn: { color: colors.white },
});

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  mealChips: { marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    marginRight: 8,
    gap: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipEmoji: { fontSize: 16 },
  chipText: { fontFamily: 'Nunito_700Bold', color: colors.text, fontSize: 13 },
  chipTextOn: { color: colors.white },

  loggedCard: { backgroundColor: 'rgba(34,197,94,0.06)', borderColor: colors.success },
  loggedTitle: {
    fontFamily: 'Nunito_700Bold',
    color: colors.success,
    marginBottom: 8,
  },
  loggedRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34,197,94,0.15)',
  },
  loggedFood: { fontFamily: 'Nunito_700Bold', color: colors.text },
  loggedMeta: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 12 },

  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  planName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.text,
  },

  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    color: colors.text,
    marginBottom: 6,
    marginTop: 8,
    fontSize: 14,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reactionBtn: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minWidth: 56,
  },
  reactionBtnOn: {
    backgroundColor: colors.bgTertiary,
    borderColor: colors.primary,
  },
  reactionEmoji: { fontSize: 20, marginBottom: 2 },
  reactionLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  reactionLabelOn: { color: colors.primary },

  sectionTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  tabBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  tabTextOn: { color: colors.white },

  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  foodOn: { backgroundColor: colors.bgTertiary, borderRadius: radii.sm, paddingHorizontal: 8 },
  foodName: { fontFamily: 'Nunito_700Bold', color: colors.text },
  foodMeta: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 12 },
  checkMark: { fontFamily: 'Nunito_800ExtraBold', color: colors.primary, fontSize: 18 },

  veggieList: {
    marginBottom: 14,
  },
  veggieItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34,197,94,0.1)',
  },
  veggieInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  veggieEmoji: { fontSize: 16 },
  veggieLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  tbspRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tbspBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#22c55e50',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.05)',
  },
  tbspBtnOn: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  tbspText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#22c55e',
  },
  tbspTextOn: { color: colors.white },
  tbspUnit: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 2,
  },
  foodNutriRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  foodNutriChip: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.bgTertiary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  photoHint: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
});
