import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, radii } from '../../src/theme';
import type { Recipe } from '../../src/types';

export default function RecipeDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { authenticated } = useAuth();
  const router = useRouter();
  const [recipe, setRecipe] = useState<(Recipe & Record<string, any>) | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.recipe(String(slug));
        setRecipe(data.recipe || data);
        setSaved(!!data.saved);
      } catch {
        setRecipe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const toggleSave = async () => {
    if (!authenticated) {
      Alert.alert('Sign in to save', 'Create an account to build your cookbook.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/login') },
      ]);
      return;
    }
    try {
      if (saved) {
        await api.unsaveRecipe(String(slug));
        setSaved(false);
      } else {
        await api.saveRecipe(String(slug));
        setSaved(true);
      }
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Try again');
    }
  };

  const nutrients = recipe
    ? [
        { label: 'Calories', value: recipe.calories, unit: 'kcal', icon: '🔥' },
        { label: 'Protein', value: recipe.protein_g, unit: 'g', icon: '💪' },
        { label: 'Iron', value: recipe.iron_mg, unit: 'mg', icon: '🩸' },
        { label: 'Calcium', value: recipe.calcium_mg, unit: 'mg', icon: '🦴' },
        { label: 'Fat', value: recipe.fat_g, unit: 'g', icon: '🧈' },
        { label: 'Carbs', value: recipe.carbs_g, unit: 'g', icon: '🍚' },
      ].filter((n) => n.value != null)
    : [];

  return (
    <Screen>
      <AppHeader title="Recipe" />
      {loading ? (
        <LoadingBlock />
      ) : !recipe ? (
        <EmptyState text="Recipe not found." />
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          {(recipe.cover_image_path || recipe.cover_url) && (
            <Image
              source={{ uri: recipe.cover_image_path || recipe.cover_url || '' }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          )}
          <Card>
            <View style={styles.titleRow}>
              <Text style={[styles.name, { flex: 1 }]}>{recipe.name}</Text>
              <Pressable onPress={toggleSave} accessibilityLabel={saved ? 'Unsave recipe' : 'Save recipe'}>
                <Text style={styles.heart}>{saved ? '❤️' : '🤍'}</Text>
              </Pressable>
            </View>
            <Text style={styles.category}>{recipe.category}</Text>

            {nutrients.length > 0 && (
              <View style={styles.nutriRow}>
                {nutrients.map((n) => (
                  <View key={n.label} style={styles.nutriChip}>
                    <Text style={styles.nutriIcon}>{n.icon}</Text>
                    <Text style={styles.nutriValue}>
                      {Math.round((n.value || 0) * 10) / 10}
                      {n.unit}
                    </Text>
                    <Text style={styles.nutriLabel}>{n.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {recipe.why ? (
              <>
                <Text style={styles.h}>Why it works</Text>
                <Text style={styles.body}>{recipe.why}</Text>
              </>
            ) : null}
            {recipe.cheese ? (
              <>
                <Text style={styles.h}>Cheese tip</Text>
                <Text style={styles.body}>{recipe.cheese}</Text>
              </>
            ) : null}
            {recipe.hidden_veggies && (
              <>
                <Text style={styles.h}>Hidden veggies</Text>
                <Text style={styles.body}>{recipe.hidden_veggies}</Text>
              </>
            )}
            {recipe.steps ? (
              <>
                <Text style={styles.h}>Steps</Text>
                <View style={styles.stepsBox}>
                  <Text style={styles.stepsText}>{recipe.steps}</Text>
                </View>
              </>
            ) : null}
            {recipe.suitable_from_months != null && (
              <Text style={styles.ageNote}>
                Suitable from {recipe.suitable_from_months} months
              </Text>
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  heart: { fontSize: 26, paddingTop: 2 },
  category: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.primary,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  nutriRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  nutriChip: {
    alignItems: 'center',
    minWidth: 60,
  },
  nutriIcon: { fontSize: 16, marginBottom: 2 },
  nutriValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: colors.text,
  },
  nutriLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
  },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 14,
    marginBottom: 4,
    color: colors.text,
    fontSize: 16,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  stepsBox: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: radii.md,
    padding: 14,
    marginTop: 4,
  },
  stepsText: {
    fontFamily: 'Nunito_400Regular',
    color: colors.text,
    lineHeight: 22,
  },
  ageNote: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
  },
});
