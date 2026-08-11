import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { AppHeader } from '../src/components/AppHeader';
import { Card, EmptyState, Field, LoadingBlock, Screen } from '../src/components/ui';
import { colors } from '../src/theme';
import type { Recipe } from '../src/types';

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (query?: string) => {
    try {
      const data = await api.recipes(query);
      setRecipes(data.recipes || data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <Screen>
      <AppHeader title="Recipes" />
      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(q);
            }}
          />
        }
      >
        <Field
          label="Search"
          value={q}
          onChangeText={(t) => {
            setQ(t);
            if (t.trim().length === 0 || t.trim().length > 2) load(t.trim());
          }}
          placeholder="Search recipes"
        />
        {loading ? <LoadingBlock /> : null}
        {recipes.map((r) => (
          <Pressable key={r.slug} onPress={() => router.push(`/recipe/${r.slug}`)}>
            <Card>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.meta}>{r.category || 'Recipe'}</Text>
              {r.why ? (
                <Text style={styles.why} numberOfLines={2}>
                  {r.why}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        ))}
        {!loading && !recipes.length ? <EmptyState text="No recipes found." /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 17, color: colors.text },
  meta: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.primary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  why: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    marginTop: 8,
  },
});
