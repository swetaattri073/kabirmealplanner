import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

/**
 * Each child gets a badge colour so they can be told apart without reading.
 * Assigned by position rather than by hashing the name, which collided for
 * real sibling names and handed both children the same colour.
 *
 * All five clear 4.5:1 against white for the initial they carry.
 */
const CHILD_COLORS = ['#4f46e5', '#c2410c', '#0f766e', '#7e22ce', '#b91c1c'];

export function childColorAt(index: number): string {
  if (index < 0) return CHILD_COLORS[0];
  return CHILD_COLORS[index % CHILD_COLORS.length];
}

export function AppHeader({ title }: { title?: string }) {
  const { activeToddler, user, toddlers } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initial = (user?.name || user?.email || activeToddler?.name || 'L').charAt(0).toUpperCase();
  const childInitial = (activeToddler?.name || '?').charAt(0).toUpperCase();
  const hasChild = !!activeToddler;
  const canSwitch = toddlers.length > 1;
  const childIndex = toddlers.findIndex((t) => t.id === activeToddler?.id);

  return (
    <View style={{ backgroundColor: colors.white }}>
      <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 6) + 6 }]}>
        <Pressable
          onPress={() => router.push('/(tabs)/dashboard')}
          hitSlop={12}
          accessibilityLabel="LittleBowl home"
          accessibilityRole="button"
        >
          <Image
            source={require('../../assets/littlebowl-mark.png')}
            style={styles.logo}
          />
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.brandText}>
            <Text style={styles.brandLittle}>Little</Text>
            <Text style={styles.brandBowl}>Bowl</Text>
          </Text>
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>

        <Pressable
          style={styles.avatar}
          onPress={() => router.push('/account')}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityLabel="My account"
          accessibilityRole="button"
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </View>

      {/* Which child this screen is about. Portion sizes and which foods are
          safe both depend on it, so it can't be left to memory. */}
      {hasChild && (
        <Pressable
          style={styles.childBar}
          onPress={() => router.push('/(tabs)/more')}
          disabled={!canSwitch}
          accessibilityRole={canSwitch ? 'button' : 'text'}
          accessibilityLabel={
            canSwitch
              ? `Showing ${activeToddler?.name}, ${activeToddler?.age_months} months old. Tap to change child.`
              : `Showing ${activeToddler?.name}, ${activeToddler?.age_months} months old.`
          }
        >
          <View style={[styles.childDot, { backgroundColor: childColorAt(childIndex) }]}>
            <Text style={styles.childDotText}>{childInitial}</Text>
          </View>
          <Text style={styles.childName} numberOfLines={1}>
            {activeToddler?.name}
          </Text>
          <Text style={styles.childAge}>{activeToddler?.age_months} months</Text>
          {canSwitch && <Text style={styles.childSwitch}>Change</Text>}
        </Pressable>
      )}
    </View>
  );
}

export function LogoHero() {
  return (
    <View style={styles.logoHero}>
      <Image
        source={require('../../assets/littlebowl-mark.png')}
        style={{ width: 72, height: 72 }}
        accessibilityLabel="LittleBowl"
      />
      <Text style={styles.heroText}>
        <Text style={styles.heroLittle}>Little</Text>
        <Text style={styles.heroBowl}>Bowl</Text>
      </Text>
      <Text style={styles.tagline}>Little meals, big growth.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
  },
  brandLittle: {
    color: '#2d5016',
  },
  brandBowl: {
    color: '#c2410c',
  },
  title: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -2,
  },
  childBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    backgroundColor: colors.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  childDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childDotText: {
    color: colors.white,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
  },
  childName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
    flexShrink: 1,
  },
  childAge: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  childSwitch: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f97316',
  },
  avatarText: {
    color: colors.white,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
  },
  logoHero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  heroText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
  },
  heroLittle: {
    color: '#4a7c28',
  },
  heroBowl: {
    color: '#d97706',
  },
  tagline: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textSecondary,
  },
});
