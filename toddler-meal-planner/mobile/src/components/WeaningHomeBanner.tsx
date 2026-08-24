import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme';

type Props = {
  childName: string;
  stageTitle?: string;
  nextFood?: string;
  triedCount?: number;
  totalFoods?: number;
  onPress: () => void;
};

/** Compact home-screen entry to the starting-solids guide (babies under 12 months). */
export function WeaningHomeBanner({
  childName,
  stageTitle,
  nextFood,
  triedCount,
  totalFoods,
  onPress,
}: Props) {
  return (
    <Pressable
      style={styles.wrap}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Starting solids guide for ${childName}. ${stageTitle || 'First foods, step by step'}. Tap to open.`}
    >
      <LinearGradient
        colors={['#fff7ed', '#ffedd5'] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🥄</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Starting solids</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
          <Text style={styles.title}>
            {stageTitle ? `${stageTitle} guide` : 'First foods guide'}
          </Text>
          <Text style={styles.sub}>
            {nextFood
              ? `Next up for ${childName}: ${nextFood}`
              : `Step-by-step weaning for ${childName}`}
          </Text>
          {triedCount != null && totalFoods != null && totalFoods > 0 ? (
            <Text style={styles.progress}>
              {triedCount} of {totalFoods} first foods tried
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.secondary,
    padding: 14,
    gap: 12,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(194, 65, 12, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  body: { flex: 1 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  arrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.secondary,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  sub: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  progress: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: colors.secondary,
    marginTop: 4,
  },
});
