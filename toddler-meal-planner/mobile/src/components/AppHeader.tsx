import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

export function AppHeader({ title }: { title?: string }) {
  const { activeToddler, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initial =
    (user?.name || user?.email || activeToddler?.name || 'L').charAt(0).toUpperCase();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 6) + 6 }]}>
      <Pressable
        onPress={() => router.push('/(tabs)/dashboard')}
        hitSlop={8}
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
    height: 64,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
  },
  brandLittle: {
    color: '#4a7c28',
  },
  brandBowl: {
    color: '#d97706',
  },
  title: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -1,
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
