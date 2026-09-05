import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../src/components/ui';
import {
  CACHE_TTL,
  getCached,
  getStale,
  invalidateCacheKey,
  screenCacheKey,
  setCached,
} from '../src/screenCache';
import { colors, radii } from '../src/theme';

export default function WeaningScreen() {
  const { activeToddler } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trying, setTrying] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!activeToddler) {
        setLoading(false);
        return;
      }
      const key = screenCacheKey('weaning', activeToddler.ref);
      const stale = getStale<any>(key);
      if (stale) {
        setData(stale);
        setLoading(false);
      }
      if (!force && getCached<any>(key, CACHE_TTL.growth)) {
        setRefreshing(false);
        return;
      }
      try {
        const w = await api.weaning(activeToddler.ref);
        setCached(key, w);
        setData(w);
      } catch {
        if (!stale) setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeToddler],
  );

  const onTryFood = async (item: any) => {
    if (!activeToddler || item.tried) return;
    setTrying(item.name);
    try {
      await api.tryWeaningFood(activeToddler.ref, {
        food_name: item.name,
        food_id: item.food_id,
        reaction: 'liked',
      });
      invalidateCacheKey(screenCacheKey('weaning', activeToddler.ref));
      await load(true);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setTrying(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (loading && !data) {
    return (
      <Screen>
        <AppHeader title="Starting solids" />
        <LoadingBlock />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <AppHeader title="Starting solids" />
        <EmptyState text="We could not load the weaning guide. Pull down to try again." />
      </Screen>
    );
  }

  const stage = data.stage || {};
  const watch = data.watch || {};

  return (
    <Screen>
      <AppHeader title="Starting solids" />
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {/* Where they are now */}
        <Card style={styles.stageCard}>
          <Text style={styles.stageStep}>
            Step {data.stage_number} of {data.stage_count}
          </Text>
          <Text style={styles.stageTitle}>{stage.title}</Text>
          <Text style={styles.stageAge}>
            For babies {stage.from_months} to {stage.to_months} months
          </Text>

          <View style={styles.factRow}>
            <Text style={styles.factLabel}>How it should feel</Text>
            <Text style={styles.factValue}>{stage.texture}</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>How often</Text>
            <Text style={styles.factValue}>{stage.meals_per_day}</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>How much</Text>
            <Text style={styles.factValue}>{stage.amount}</Text>
          </View>

          <Text style={styles.milkNote}>{stage.milk_note}</Text>

          {data.video_url ? (
            <Pressable
              style={styles.videoLink}
              onPress={() => Linking.openURL(data.video_url)}
              accessibilityRole="link"
            >
              <Text style={styles.videoLinkText}>Watch how to prepare →</Text>
              <Text style={styles.videoDisclaimer}>{data.video_disclaimer}</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* First foods checklist */}
        {(data.checklist || []).length > 0 && (
          <Card>
            <Text style={styles.h}>First foods checklist</Text>
            <Text style={styles.body}>Tap when your baby has tried a food.</Text>
            {(data.checklist || []).map((item: any) => (
              <View key={item.name} style={styles.checkRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkName}>
                    {item.tried ? '✓ ' : ''}
                    {item.name}
                    {item.hindi ? `  ${item.hindi}` : ''}
                  </Text>
                  <Text style={styles.checkWhy}>{item.why}</Text>
                </View>
                {!item.tried ? (
                  <Pressable
                    style={styles.tryBtn}
                    onPress={() => onTryFood(item)}
                    disabled={trying === item.name}
                  >
                    <Text style={styles.tryBtnText}>
                      {trying === item.name ? '…' : 'Tried it'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {/* Progress through the food list */}
        <Card>
          <Text style={styles.h}>Foods tried</Text>
          <Text style={styles.big}>
            {data.tried_count} of {data.total_foods}
          </Text>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${data.total_foods ? (data.tried_count / data.total_foods) * 100 : 0}%`,
                },
              ]}
            />
          </View>
        </Card>

        {/* The single most useful thing on the screen: what to do next */}
        {watch.waiting ? (
          <Card style={styles.waitCard}>
            <Text style={styles.waitTitle}>Wait {watch.days_left} more day
              {watch.days_left === 1 ? '' : 's'}</Text>
            <Text style={styles.body}>
              You started a new food recently. Waiting {watch.wait_days} days before the next new
              one means that if your baby reacts, you know which food caused it.
            </Text>
            <Text style={styles.body}>
              Keep offering foods they have already had. Those are fine every day.
            </Text>
          </Card>
        ) : data.next_food ? (
          <Card style={styles.nextCard}>
            <Text style={styles.nextLabel}>TRY THIS NEXT</Text>
            <Text style={styles.nextName}>
              {data.next_food.name}
              {data.next_food.hindi ? `  ${data.next_food.hindi}` : ''}
            </Text>
            <Text style={styles.body}>{data.next_food.why}</Text>
            <Pressable
              style={styles.cta}
              onPress={() => router.push('/(tabs)/log')}
              accessibilityRole="button"
              accessibilityLabel={`Log that you gave ${data.next_food.name}`}
            >
              <Text style={styles.ctaText}>We tried it — log it</Text>
            </Pressable>
          </Card>
        ) : (
          <Card>
            <Text style={styles.h}>Every food for this step is done</Text>
            <Text style={styles.body}>
              Lovely. Keep offering what they like, and new foods will appear as {data.toddler?.name}{' '}
              grows.
            </Text>
          </Card>
        )}

        {/* Allergens */}
        <Card>
          <Text style={styles.h}>Allergy foods</Text>
          <Text style={styles.body}>
            Giving these early, one at a time, lowers the chance of an allergy. Offer a small
            amount at home, in the morning, when your baby is well.
          </Text>
          <Text style={styles.big}>
            {data.allergens_done} of {data.allergens_total} started
          </Text>
          {data.next_allergen && (
            <View style={styles.allergenNext}>
              <Text style={styles.allergenName}>Next: {data.next_allergen.label}</Text>
              <Text style={styles.body}>{data.next_allergen.how}</Text>
            </View>
          )}
          <View style={styles.chipWrap}>
            {(data.allergens || []).map((a: any) => (
              <View
                key={a.key}
                style={[styles.chip, a.introduced && styles.chipDone, a.skip && styles.chipSkip]}
              >
                <Text style={[styles.chipText, a.introduced && styles.chipTextDone]}>
                  {a.introduced ? '✓ ' : ''}
                  {a.label}
                  {a.skip ? ' (allergy)' : ''}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Safety. Deliberately last but visually loudest. */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerH}>Never before 1 year old</Text>
          {(data.never_before_one || []).map((item: any) => (
            <View key={item.item} style={styles.dangerRow}>
              <Text style={styles.dangerItem}>{item.item}</Text>
              <Text style={styles.body}>{item.why}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.dangerCard}>
          <Text style={styles.dangerH}>Get help straight away if you see</Text>
          {(data.reaction_signs?.urgent || []).map((sign: string) => (
            <Text key={sign} style={styles.urgentSign}>
              • {sign}
            </Text>
          ))}
          <Text style={[styles.h, { marginTop: 12 }]}>Tell your doctor about</Text>
          {(data.reaction_signs?.watch || []).map((sign: string) => (
            <Text key={sign} style={styles.body}>
              • {sign}
            </Text>
          ))}
        </Card>

        <Text style={styles.disclaimer}>
          This is general guidance, not advice about your own baby. Ask your doctor if you are
          unsure about anything.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  big: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: colors.primary,
    marginVertical: 4,
  },

  stageCard: { backgroundColor: colors.bgTertiary, borderColor: colors.primary },
  stageStep: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  stageTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: colors.text,
  },
  stageAge: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  factRow: { marginBottom: 10 },
  factLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  factValue: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  milkNote: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: colors.text,
    marginTop: 6,
    lineHeight: 22,
  },
  videoLink: { marginTop: 12, paddingTop: 8 },
  videoLinkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.secondary,
  },
  videoDisclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  checkWhy: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.white,
  },

  barBg: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: 14, borderRadius: 7, backgroundColor: colors.primary },

  nextCard: { borderColor: colors.primary, borderWidth: 3 },
  nextLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13,
    letterSpacing: 1,
    color: colors.primary,
  },
  nextName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: colors.text,
    marginBottom: 6,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.white,
  },

  waitCard: { backgroundColor: '#fff7ed', borderColor: colors.secondary, borderWidth: 3 },
  waitTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: colors.secondary,
    marginBottom: 6,
  },

  allergenNext: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 10,
  },
  allergenName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.text,
    marginBottom: 4,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  chipDone: { backgroundColor: '#dcfce7', borderColor: colors.successText },
  chipSkip: { backgroundColor: colors.bgTertiary, opacity: 0.6 },
  chipText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
  chipTextDone: { color: colors.successText },

  dangerCard: { borderColor: colors.danger, borderWidth: 2 },
  dangerH: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.danger,
    marginBottom: 8,
  },
  dangerRow: { marginBottom: 10 },
  dangerItem: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  urgentSign: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.danger,
    lineHeight: 24,
  },
  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
});
