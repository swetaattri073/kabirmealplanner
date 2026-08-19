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
        style={styles.brandPress}
        hitSlop={8}
      >
        <Image
          source={require('../../assets/littlebowl-mark.png')}
          style={styles.logo}
        />
        <View>
          <Text style={styles.brandLittle}>
            Little<Text style={styles.brandBowl}>Bowl</Text>
          </Text>
        </View>
      </Pressable>
      <View style={styles.mid}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <Pressable
        style={styles.avatar}
        onPress={() => router.push('/account')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
      <Text style={styles.heroLittle}>
        Little<Text style={styles.heroBowl}>Bowl</Text>
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
    gap: 10,
  },
  brandPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandLittle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: '#2d5016',
  },
  brandBowl: {
    fontFamily: 'Nunito_800ExtraBold',
    color: '#d97706',
  },
  mid: { flex: 1, paddingLeft: 4 },
  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  avatarText: {
    color: colors.white,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
  },
  logoHero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  heroLittle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: '#2d5016',
  },
  heroBowl: {
    color: '#d97706',
  },
  tagline: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textSecondary,
  },
});
