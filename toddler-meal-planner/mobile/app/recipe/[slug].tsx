import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors } from '../../src/theme';
import type { Recipe } from '../../src/types';

export default function RecipeDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.recipe(String(slug));
        setRecipe(data.recipe || data);
      } catch {
        setRecipe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <Screen>
      <AppHeader title="Recipe" />
      {loading ? (
        <LoadingBlock />
      ) : !recipe ? (
        <EmptyState text="Recipe not found." />
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <Card>
            <Text style={styles.name}>{recipe.name}</Text>
            <Text style={styles.meta}>{recipe.category}</Text>
            {recipe.why ? (
              <>
                <Text style={styles.h}>Why</Text>
                <Text style={styles.body}>{recipe.why}</Text>
              </>
            ) : null}
            {recipe.cheese ? (
              <>
                <Text style={styles.h}>Cheese tip</Text>
                <Text style={styles.body}>{recipe.cheese}</Text>
              </>
            ) : null}
            {recipe.steps ? (
              <>
                <Text style={styles.h}>Steps</Text>
                <Text style={styles.body}>{recipe.steps}</Text>
              </>
            ) : null}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: colors.text },
  meta: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.primary,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 12,
    marginBottom: 4,
    color: colors.text,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
