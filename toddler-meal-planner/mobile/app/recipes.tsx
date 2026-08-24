import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { EmptyState, Field, LoadingBlock, Screen } from '../src/components/ui';
import { colors, radii } from '../src/theme';
import type { Recipe } from '../src/types';

const RECIPE_COLORS = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#ede9fe', '#fee2e2', '#e0f2fe', '#fef9c3'];
const RECIPE_EMOJIS = ['🥣', '🍲', '🥗', '🍛', '🥘', '🍜', '🍝', '🥙', '🍳', '🥞'];

export default function RecipesScreen() {
  const router = useRouter();
  const { activeToddler } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (query?: string) => {
    try {
      const data = await api.recipes({
        q: query,
        age_months: activeToddler?.age_months,
      });
      setRecipes(data.recipes || data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeToddler?.age_months]);

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
          placeholder="Search recipes..."
        />
        {loading ? <LoadingBlock /> : null}
        <View style={styles.grid}>
          {recipes.map((r, i) => (
            <Pressable
              key={r.slug}
              style={[styles.card, { backgroundColor: RECIPE_COLORS[i % RECIPE_COLORS.length] }]}
              onPress={() => router.push(`/recipe/${r.slug}`)}
            >
              {(r.cover_image_path || r.cover_url) ? (
                <Image
                  source={{ uri: r.cover_image_path || r.cover_url || '' }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.emoji}>{RECIPE_EMOJIS[i % RECIPE_EMOJIS.length]}</Text>
              )}
              <Text style={styles.name} numberOfLines={2}>{r.name}</Text>
              <Text style={styles.category}>{r.category || 'Recipe'}</Text>
              {r.why ? (
                <Text style={styles.why} numberOfLines={2}>{r.why}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
        {!loading && !recipes.length ? <EmptyState text="No recipes found." /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    borderRadius: radii.md,
    padding: 14,
    minHeight: 150,
  },
  coverImage: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    marginBottom: 8,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  category: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.primary,
    fontSize: 12,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  why: {
    fontFamily: 'Nunito_400Regular',
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
