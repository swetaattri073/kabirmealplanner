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
import { Button, Field, Screen, Title, Subtitle } from '../src/components/ui';
import { colors, radii } from '../src/theme';

const DIETS = ['vegetarian', 'eggetarian', 'non_vegetarian'];
const ALLERGENS = ['milk', 'egg', 'peanut', 'tree_nut', 'wheat', 'soy', 'fish', 'shellfish'];

// Without these the underscored database keys reach the screen as "Tree_nut"
// and "Non_vegetarian".
const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Eggetarian',
  non_vegetarian: 'Non-vegetarian',
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { addToddlerLocal, refresh, toddlers } = useAuth();
  const [name, setName] = useState('');
  // Left empty on purpose: a pre-filled 18 is wrong for most children and gets
  // accepted unchanged, which silently sets the wrong portions and food safety.
  const [age, setAge] = useState('');
  const [diet, setDiet] = useState('vegetarian');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const isFirstChild = toddlers.length === 0;

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("What is your child's name?", 'Please type a name so we can set up their meals.');
      return;
    }
    const ageMonths = parseInt(age, 10);
    if (!ageMonths || ageMonths < 6 || ageMonths > 60) {
      Alert.alert(
        'Please check the age',
        'Type the age in months, between 6 and 60.\n\nA 6-month-old baby is 6.\nA 1 year 10 month old is 22.\nA 2 year old is 24.',
      );
      return;
    }
    setLoading(true);
    try {
      const toddler = await api.createToddler({
        name: name.trim(),
        age_months: ageMonths,
        dietary_preference: diet,
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

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {/* Without this there is no way off this screen except the system
              back gesture, which strands anyone who opened it by mistake. */}
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

          <Title>{isFirstChild ? 'Welcome to LittleBowl' : 'Add another child'}</Title>
          <Subtitle>
            {isFirstChild
              ? 'Tell us about your child so we can plan their meals.'
              : 'Tell us about your other child. You can switch between children at any time.'}
          </Subtitle>

          <Field
            label="Child's name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Aarav"
          />
          <Field
            label="Age in months"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="e.g. 6"
          />
          <Text style={styles.help}>
            A 6-month-old baby is 6. A 1 year 10 month old is 22. A 2 year old is 24.
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
    // 48dp floor so the chips are reliably hittable with reduced fine-motor control.
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
});
