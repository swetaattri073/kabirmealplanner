import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import { BrandMark } from './ui';

export function AppHeader({ title }: { title?: string }) {
  const { activeToddler, user } = useAuth();
  const router = useRouter();
  const initial =
    (user?.name || user?.email || activeToddler?.name || 'L').charAt(0).toUpperCase();

  return (
    <View style={styles.wrap}>
      <BrandMark size={36} />
      <View style={styles.mid}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {activeToddler ? (
          <Text style={styles.sub}>
            {activeToddler.name} · {activeToddler.age_months} mo
          </Text>
        ) : null}
      </View>
      <Pressable
        style={styles.avatar}
        onPress={() => router.push('/account')}
        accessibilityLabel="My account"
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
      <BrandMark size={48} />
      <Text style={styles.tagline}>Little meals, big growth.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  mid: { flex: 1 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.text,
  },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontFamily: 'Nunito_700Bold',
  },
  logoHero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  tagline: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textSecondary,
  },
});
