import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/AuthContext';
import { AppHeader, childColorAt } from '../../src/components/AppHeader';
import { Screen } from '../../src/components/ui';
import { colors, radii } from '../../src/theme';
import type { Toddler } from '../../src/types';

const LINKS = [
  { href: '/cookbook', label: 'Cookbook', hint: 'Your saved recipes' },
  { href: '/growth', label: 'Growth', hint: 'Weight & height tracking' },
  { href: '/preferences', label: 'Food preferences', hint: 'Liked, exploring, avoid' },
  { href: '/recipes', label: 'Recipes', hint: 'Meal ideas for your child' },
  { href: '/chat', label: 'Ask LittleBowl', hint: 'Mealtime questions' },
  { href: '/account', label: 'My account', hint: 'Profile & meal reminders' },
  { href: '/onboarding', label: 'Add a child', hint: 'Set up another profile' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { toddlers, activeToddler, setActiveToddler } = useAuth();

  // Weaning only applies while a baby is starting solids, so it appears and
  // disappears with the selected child rather than cluttering the menu forever.
  const age = activeToddler?.age_months ?? 0;
  const links =
    age > 0 && age < 12
      ? [
          {
            href: '/weaning',
            label: 'Starting solids',
            hint: 'First foods, step by step',
          },
          ...LINKS,
        ]
      : LINKS;

  const selectChild = async (t: Toddler) => {
    await setActiveToddler(t);
    router.push('/(tabs)/dashboard');
  };

  return (
    <Screen>
      <AppHeader title="More" />
      <View style={styles.pad}>
        {toddlers.length > 1 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Who are you planning for?</Text>
            {toddlers.map((t, i) => {
              const on = activeToddler?.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[styles.childRow, on && styles.childRowOn]}
                  onPress={() => selectChild(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${t.name}, ${t.age_months} months old, and open Home`}
                >
                  <View style={[styles.childDot, { backgroundColor: childColorAt(i) }]}>
                    <Text style={styles.childDotText}>
                      {(t.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t.name}</Text>
                    <Text style={styles.hint}>{t.age_months} months old</Text>
                  </View>
                  {/* A tick as well as the tint: colour alone fails WCAG 1.4.1
                      and is easy to miss with low contrast sensitivity. */}
                  {on && <Text style={styles.tick}>✓ Showing now</Text>}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {links.map((l) => (
          <Pressable
            key={l.href}
            style={styles.row}
            onPress={() => router.push(l.href as any)}
            accessibilityRole="button"
            accessibilityLabel={`${l.label}. ${l.hint}`}
          >
            <View>
              <Text style={styles.label}>{l.label}</Text>
              <Text style={styles.hint}>{l.hint}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  block: { marginBottom: 12 },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    marginBottom: 8,
    color: colors.text,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 48,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childRow: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 48,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childRowOn: { borderColor: colors.primary, borderWidth: 3, backgroundColor: colors.bgTertiary },
  childDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childDotText: {
    color: colors.white,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
  },
  tick: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  label: { fontFamily: 'Nunito_700Bold', color: colors.text, fontSize: 17 },
  hint: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  chev: { fontSize: 24, color: colors.textSecondary },
});
