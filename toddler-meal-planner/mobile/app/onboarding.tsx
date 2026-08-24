import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import {
  ageMonthsFromBirth,
  DatePickerRow,
  formatBirthDateISO,
} from '../src/components/DatePickerRow';
import { Button, Field, Screen, Title, Subtitle } from '../src/components/ui';
import { colors, radii } from '../src/theme';

const DIETS = ['vegetarian', 'eggetarian', 'non_vegetarian'];
const ALLERGENS = ['milk', 'egg', 'peanut', 'tree_nut', 'wheat', 'soy', 'fish', 'shellfish'];

const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Eggetarian',
  non_vegetarian: 'Non-vegetarian',
};

const ACTIVITY_LEVELS = ['low', 'moderate', 'high'] as const;
const ACTIVITY_LABELS: Record<string, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
};

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'Milk',
  egg: 'Egg',
  peanut: 'Peanut',
  tree_nut: 'Tree nuts',
  wheat: 'Wheat',
  soy: 'Soy',
  fish: 'Fish',
  shellfish: 'Shellfish',
};

type SetupPath = 'solids' | 'toddler';

function defaultBirthDate(path: SetupPath): Date {
  const d = new Date();
  if (path === 'solids') {
    d.setMonth(d.getMonth() - 6);
  } else {
    d.setMonth(d.getMonth() - 18);
  }
  return d;
}

function minBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { addToddlerLocal, refresh, toddlers } = useAuth();
  const isFirstChild = toddlers.length === 0;

  const [step, setStep] = useState<'path' | 'profile'>(isFirstChild ? 'path' : 'profile');
  const [setupPath, setSetupPath] = useState<SetupPath>('solids');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date>(() => defaultBirthDate('solids'));
  const [diet, setDiet] = useState('vegetarian');
  const [activity, setActivity] = useState('moderate');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const choosePath = (path: SetupPath) => {
    setSetupPath(path);
    setBirthDate(defaultBirthDate(path));
    if (path === 'solids') setDiet('vegetarian');
    setStep('profile');
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("What is your child's name?", 'Please type a name so we can set up their meals.');
      return;
    }
    const ageMonths = ageMonthsFromBirth(birthDate);
    if (ageMonths < 6 || ageMonths > 60) {
      Alert.alert(
        'Please check the date of birth',
        'LittleBowl supports babies from 6 months up to about 5 years old.',
      );
      return;
    }
    if (setupPath === 'toddler' && ageMonths < 12 && isFirstChild) {
      Alert.alert(
        'Under 12 months?',
        'For babies starting solids, choose the Starting solids path for weaning guidance.',
        [
          { text: 'Continue anyway', style: 'cancel' },
          {
            text: 'Switch to Starting solids',
            onPress: () => {
              setSetupPath('solids');
              setDiet('vegetarian');
            },
          },
        ],
      );
      return;
    }
    setLoading(true);
    try {
      const toddler = await api.createToddler({
        name: name.trim(),
        birth_date: formatBirthDateISO(birthDate),
        age_months: ageMonths,
        dietary_preference: diet,
        activity_level: activity,
        allergies,
      });
      await addToddlerLocal(toddler);
      try {
        await refresh();
      } catch {
        /* local state already has toddler */
      }
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Could not save profile', e?.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'path' && isFirstChild) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.pad}>
          <Title>Who are you setting up?</Title>
          <Subtitle>Pick the path that fits your child right now.</Subtitle>

          <Pressable
            style={[styles.pathCard, setupPath === 'solids' && styles.pathCardOn]}
            onPress={() => choosePath('solids')}
            accessibilityRole="button"
          >
            <Text style={styles.pathEmoji}>🥄</Text>
            <Text style={styles.pathTitle}>Starting solids (6–12 months)</Text>
            <Text style={styles.pathBody}>
              First tastes, textures, and allergen guidance — step by step.
            </Text>
          </Pressable>

          <Pressable
            style={[styles.pathCard, setupPath === 'toddler' && styles.pathCardOn]}
            onPress={() => choosePath('toddler')}
            accessibilityRole="button"
          >
            <Text style={styles.pathEmoji}>🧒</Text>
            <Text style={styles.pathTitle}>Toddler (12+ months)</Text>
            <Text style={styles.pathBody}>
              Weekly meal plans, nutrition tracking, and picky-eater help.
            </Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {!isFirstChild && (
            <Pressable
              onPress={() => router.back()}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Go back without adding a child"
            >
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          )}

          {isFirstChild && (
            <Pressable onPress={() => setStep('path')} style={styles.back}>
              <Text style={styles.backText}>← Change path</Text>
            </Pressable>
          )}

          <Title>{isFirstChild ? 'Welcome to LittleBowl' : 'Add another child'}</Title>
          <Subtitle>
            {setupPath === 'solids'
              ? 'Tell us about your baby so we can guide first foods safely.'
              : 'Tell us about your child so we can plan their meals.'}
          </Subtitle>

          <Field
            label="Child's name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Aarav"
          />

          <DatePickerRow
            label="Baby's date of birth"
            helper="We use this to update age automatically."
            value={birthDate}
            onChange={setBirthDate}
            minimumDate={minBirthDate()}
            maximumDate={new Date()}
          />
          <Text style={styles.help}>
            About {ageMonthsFromBirth(birthDate)} months old today.
          </Text>

          <Text style={styles.label}>Diet</Text>
          <View style={styles.row}>
            {DIETS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDiet(d)}
                style={[styles.chip, diet === d && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: diet === d }}
                accessibilityLabel={DIET_LABELS[d]}
              >
                <Text style={[styles.chipText, diet === d && styles.chipTextOn]}>
                  {DIET_LABELS[d]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Activity level</Text>
          <Text style={styles.help}>How active is your child day to day?</Text>
          <View style={styles.row}>
            {ACTIVITY_LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => setActivity(level)}
                style={[styles.chip, activity === level && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: activity === level }}
                accessibilityLabel={ACTIVITY_LABELS[level]}
              >
                <Text style={[styles.chipText, activity === level && styles.chipTextOn]}>
                  {ACTIVITY_LABELS[level]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Allergies</Text>
          <Text style={styles.help}>Tap any food your child must not eat. Tap again to undo.</Text>
          <View style={styles.row}>
            {ALLERGENS.map((a) => (
              <Pressable
                key={a}
                onPress={() => toggleAllergy(a)}
                style={[styles.chip, allergies.includes(a) && styles.chipOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allergies.includes(a) }}
                accessibilityLabel={ALLERGEN_LABELS[a]}
              >
                <Text
                  style={[styles.chipText, allergies.includes(a) && styles.chipTextOn]}
                >
                  {ALLERGEN_LABELS[a]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button label="Start planning" onPress={onSubmit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24, paddingTop: 56 },
  back: {
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 8,
  },
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: colors.primary,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    marginBottom: 8,
    color: colors.text,
  },
  help: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: -8,
    lineHeight: 20,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  chipTextOn: { color: colors.white },
  pathCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 20,
    marginBottom: 14,
    backgroundColor: colors.white,
  },
  pathCardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.bgTertiary,
  },
  pathEmoji: { fontSize: 32, marginBottom: 8 },
  pathTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 6,
  },
  pathBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
