import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/AuthContext';
import { api } from '../src/api';
import {
  loadNotifyPrefs,
  saveNotifyPrefs,
} from '../src/notifications';
import type { NotifyPrefs } from '../src/storage';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Card, Field, Screen } from '../src/components/ui';
import { colors, DEFAULT_REMINDER_TIMES, MEAL_LABELS, radii } from '../src/theme';

const DIET_LABELS: Record<string, string> = {
  vegetarian: '🥬 Vegetarian',
  eggetarian: '🥚 Eggetarian',
  'non-vegetarian': '🍗 Non-vegetarian',
  vegan: '🌱 Vegan',
};

const REACTION_EMOJI: Record<string, string> = {
  loved: '😍',
  liked: '🙂',
  neutral: '😐',
  disliked: '😕',
  refused: '🙅',
};

export default function AccountScreen() {
  const { user, authenticated, logout, activeToddler, toddlers } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [foodPrefs, setFoodPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotifyPrefs().then(setPrefs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeToddler) {
        api.preferences(activeToddler.ref).then(setFoodPrefs).catch(() => null);
      }
    }, [activeToddler]),
  );

  const updateTime = (key: string, value: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, times: { ...prefs.times, [key]: value } });
  };

  const saveReminders = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const next = {
        ...prefs,
        toddlerRef: activeToddler?.ref || prefs.toddlerRef,
        toddlerName: activeToddler?.name || prefs.toddlerName,
      };
      await saveNotifyPrefs(next);
      setPrefs(next);
      Alert.alert('Saved', 'Meal reminders updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  const t = activeToddler;
  const likedFoods = (foodPrefs?.liked || foodPrefs?.loved || []).slice(0, 10);
  const dislikedFoods = (foodPrefs?.disliked || foodPrefs?.challenging || []).slice(0, 5);

  return (
    <Screen>
      <AppHeader title="My account" />
      <ScrollView contentContainerStyle={styles.pad}>
        {/* User profile */}
        <Card>
          <Text style={styles.h}>Profile</Text>
          {authenticated && user ? (
            <>
              <View style={styles.profileRow}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6'] as [string, string]}
                  style={styles.profileAvatar}
                >
                  <Text style={styles.profileInitial}>
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{user.name || 'Parent'}</Text>
                  <Text style={styles.profileEmail}>{user.email}</Text>
                  {user.subscription_tier && (
                    <Text style={styles.profileTier}>
                      {user.is_premium ? '⭐ Premium' : '🆓 Free plan'}
                    </Text>
                  )}
                </View>
              </View>
              <Button label="Sign out" variant="danger" onPress={onLogout} />
            </>
          ) : (
            <>
              <Text style={styles.meta}>You are using LittleBowl as a guest.</Text>
              <Button label="Create account" onPress={() => router.push('/register')} />
              <Button label="Sign in" variant="ghost" onPress={() => router.push('/login')} />
            </>
          )}
        </Card>

        {/* Toddler profile */}
        {t && (
          <Card>
            <Text style={styles.h}>Toddler Profile</Text>
            <View style={styles.profileRow}>
              <LinearGradient
                colors={['#f97316', '#fb923c'] as [string, string]}
                style={styles.toddlerAvatar}
              >
                <Text style={styles.toddlerInitial}>
                  {t.name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{t.name}</Text>
                <Text style={styles.profileEmail}>{t.age_months} months old</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              {t.birth_date && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>🎂</Text>
                  <Text style={styles.detailLabel}>Born</Text>
                  <Text style={styles.detailValue}>{t.birth_date}</Text>
                </View>
              )}
              {t.gender && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>{t.gender === 'male' ? '👦' : t.gender === 'female' ? '👧' : '👶'}</Text>
                  <Text style={styles.detailLabel}>Gender</Text>
                  <Text style={styles.detailValue}>{t.gender}</Text>
                </View>
              )}
              {t.weight_kg != null && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>⚖️</Text>
                  <Text style={styles.detailLabel}>Weight</Text>
                  <Text style={styles.detailValue}>{t.weight_kg} kg</Text>
                </View>
              )}
              {t.height_cm != null && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>📏</Text>
                  <Text style={styles.detailLabel}>Height</Text>
                  <Text style={styles.detailValue}>{t.height_cm} cm</Text>
                </View>
              )}
              {t.activity_level && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>🏃</Text>
                  <Text style={styles.detailLabel}>Activity</Text>
                  <Text style={styles.detailValue}>{t.activity_level}</Text>
                </View>
              )}
            </View>

            {/* Dietary preference */}
            {t.dietary_preference && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>Diet</Text>
                <View style={styles.tagChip}>
                  <Text style={styles.tagText}>
                    {DIET_LABELS[t.dietary_preference] || t.dietary_preference}
                  </Text>
                </View>
              </View>
            )}

            {/* Allergies */}
            {t.allergies && t.allergies.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>Allergies</Text>
                <View style={styles.tagsRow}>
                  {t.allergies.map((a) => (
                    <View key={a} style={styles.allergyChip}>
                      <Text style={styles.allergyText}>⚠️ {a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Health conditions */}
            {t.health_conditions && t.health_conditions.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>Health conditions</Text>
                <View style={styles.tagsRow}>
                  {t.health_conditions.map((c) => (
                    <View key={c} style={styles.conditionChip}>
                      <Text style={styles.conditionText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Card>
        )}

        {/* Food preferences */}
        {t && (
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.h}>Food Preferences</Text>
              <Pressable onPress={() => router.push('/preferences')}>
                <Text style={styles.linkText}>Edit →</Text>
              </Pressable>
            </View>

            {likedFoods.length > 0 && (
              <>
                <Text style={styles.prefLabel}>Loved & Liked</Text>
                <View style={styles.tagsRow}>
                  {likedFoods.map((f: any) => (
                    <View key={f.food_id || f.name} style={styles.likedChip}>
                      <Text style={styles.likedText}>
                        {REACTION_EMOJI[f.last_reaction] || '🙂'} {f.food_name || f.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {dislikedFoods.length > 0 && (
              <>
                <Text style={styles.prefLabel}>Challenging</Text>
                <View style={styles.tagsRow}>
                  {dislikedFoods.map((f: any) => (
                    <View key={f.food_id || f.name} style={styles.dislikedChip}>
                      <Text style={styles.dislikedText}>
                        {REACTION_EMOJI[f.last_reaction] || '😕'} {f.food_name || f.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!likedFoods.length && !dislikedFoods.length && (
              <Text style={styles.meta}>Log meals to build food preferences.</Text>
            )}
          </Card>
        )}

        {/* Meal reminders */}
        <Card>
          <Text style={styles.h}>Meal reminders</Text>
          <Text style={styles.meta}>
            Edit reminder times (24h HH:MM format).
          </Text>
          {prefs ? (
            <>
              <Button
                label={prefs.enabled ? 'Reminders: ON' : 'Reminders: OFF'}
                variant={prefs.enabled ? 'primary' : 'secondary'}
                onPress={() => setPrefs({ ...prefs, enabled: !prefs.enabled })}
              />
              {Object.keys(DEFAULT_REMINDER_TIMES).map((key) => (
                <View key={key} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{MEAL_LABELS[key]}</Text>
                  <TextInput
                    value={prefs.times[key] || DEFAULT_REMINDER_TIMES[key]}
                    onChangeText={(t) => updateTime(key, t)}
                    style={styles.timeInput}
                    placeholder="08:00"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <Button label="Save reminders" onPress={saveReminders} loading={saving} />
            </>
          ) : null}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#ffffff',
  },
  profileName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  profileEmail: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  profileTier: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  toddlerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toddlerInitial: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#ffffff',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  detailItem: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.sm,
    padding: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  detailIcon: { fontSize: 18, marginBottom: 2 },
  detailLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.text,
    textTransform: 'capitalize',
  },
  tagSection: {
    marginBottom: 12,
  },
  tagLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
  },
  tagChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgTertiary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergyChip: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  allergyText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#dc2626',
  },
  conditionChip: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  conditionText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#2563eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  prefLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  likedChip: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  likedText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#16a34a',
  },
  dislikedChip: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  dislikedText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#dc2626',
  },
  line: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: colors.text },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeLabel: { fontFamily: 'Nunito_600SemiBold', color: colors.text, flex: 1 },
  timeInput: {
    width: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.white,
  },
});
