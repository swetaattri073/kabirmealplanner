import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Screen } from '../../src/components/ui';
import { colors, radii } from '../../src/theme';

const LINKS = [
  { href: '/preferences', label: 'Food preferences', hint: 'Liked, exploring, avoid' },
  { href: '/recipes', label: 'Recipes', hint: 'Toddler-friendly ideas' },
  { href: '/chat', label: 'Ask LittleBowl', hint: 'Mealtime questions' },
  { href: '/account', label: 'My account', hint: 'Profile & meal reminders' },
  { href: '/onboarding', label: 'Add toddler', hint: 'Another profile' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { toddlers, activeToddler, setActiveToddler } = useAuth();

  return (
    <Screen>
      <AppHeader title="More" />
      <View style={styles.pad}>
        {toddlers.length > 1 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Switch toddler</Text>
            {toddlers.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.row, activeToddler?.id === t.id && styles.rowOn]}
                onPress={() => setActiveToddler(t)}
              >
                <Text style={styles.label}>
                  {t.name} · {t.age_months} mo
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {LINKS.map((l) => (
          <Pressable key={l.href} style={styles.row} onPress={() => router.push(l.href as any)}>
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
    marginBottom: 8,
    color: colors.text,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.bgTertiary },
  label: { fontFamily: 'Nunito_700Bold', color: colors.text, fontSize: 16 },
  hint: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, marginTop: 2 },
  chev: { fontSize: 22, color: colors.textMuted },
});
