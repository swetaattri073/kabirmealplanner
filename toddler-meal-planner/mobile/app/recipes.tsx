import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { EmptyState, Field, LoadingBlock, Screen } from '../src/components/ui';
import {
  CACHE_TTL,
  getCached,
  getStale,
  screenCacheKey,
  setCached,
} from '../src/screenCache';
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, force = false) => {
      const qKey = query || '';
      const key = screenCacheKey('recipes', activeToddler?.ref || 'all', qKey || 'default');
      const stale = getStale<Recipe[]>(key);
      if (stale) {
        setRecipes(stale);
        setLoading(false);
      }
      if (!force && getCached<Recipe[]>(key, CACHE_TTL.recipes)) {
        setRefreshing(false);
        return;
      }
      try {
        const data = await api.recipes({
          q: query,
          age_months: activeToddler?.age_months,
        });
        const list = data.recipes || data || [];
        const next = Array.isArray(list) ? list : [];
        setCached(key, next);
        setRecipes(next);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeToddler?.age_months, activeToddler?.ref],
  );

  useFocusEffect(
    useCallback(() => {
      load('', false);
    }, [load]),
  );

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const onSearchChange = useCallback(
    (t: string) => {
      setQ(t);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const trimmed = t.trim();
      if (trimmed.length === 0) {
        load('', false);
        return;
      }
      if (trimmed.length < 2) return;
      searchTimer.current = setTimeout(() => load(trimmed, false), 300);
    },
    [load],
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
              load(q, true);
            }}
          />
        }
      >
        <Field
          label="Search"
          value={q}
          onChangeText={onSearchChange}
          placeholder="Search recipes..."
        />
        {loading && !recipes.length ? <LoadingBlock /> : null}
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
