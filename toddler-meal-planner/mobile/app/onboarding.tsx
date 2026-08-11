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

export default function OnboardingScreen() {
  const router = useRouter();
  const { addToddlerLocal, refresh } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('18');
  const [diet, setDiet] = useState('vegetarian');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    const ageMonths = parseInt(age, 10);
    if (!ageMonths || ageMonths < 6 || ageMonths > 60) {
      Alert.alert('Enter age in months (6–60)');
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
      await refresh();
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
          <Title>Welcome to LittleBowl</Title>
          <Subtitle>Tell us about your toddler so we can personalize meals.</Subtitle>
          <Field label="Toddler name" value={name} onChangeText={setName} placeholder="e.g. Aarav" />
          <Field
            label="Age (months)"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />
          <Text style={styles.label}>Diet</Text>
          <View style={styles.row}>
            {DIETS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDiet(d)}
                style={[styles.chip, diet === d && styles.chipOn]}
              >
                <Text style={[styles.chipText, diet === d && styles.chipTextOn]}>
                  {d.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Allergies</Text>
          <View style={styles.row}>
            {ALLERGENS.map((a) => (
              <Pressable
                key={a}
                onPress={() => toggleAllergy(a)}
                style={[styles.chip, allergies.includes(a) && styles.chipOn]}
              >
                <Text
                  style={[styles.chipText, allergies.includes(a) && styles.chipTextOn]}
                >
                  {a}
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
  label: {
    fontFamily: 'Nunito_700Bold',
    marginBottom: 8,
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.text,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: colors.white },
});
