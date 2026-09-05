import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { Button, EmptyState, LoadingBlock, Screen } from '../src/components/ui';
import {
  CACHE_TTL,
  getCached,
  getStale,
  screenCacheKey,
  setCached,
} from '../src/screenCache';
import { colors, radii } from '../src/theme';
import type { Recipe } from '../src/types';

export default function CookbookScreen() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!authenticated) {
        setLoading(false);
        return;
      }
      const key = screenCacheKey('cookbook', 'user');
      const stale = getStale<Recipe[]>(key);
      if (stale) {
        setRecipes(stale);
        setLoading(false);
      }
      if (!force && getCached<Recipe[]>(key, CACHE_TTL.cookbook)) {
        setRefreshing(false);
        return;
      }
      try {
        const data = await api.savedRecipes();
        const list = data.recipes || [];
        setCached(key, list);
        setRecipes(list);
      } catch {
        setRecipes([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authenticated],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (!authenticated) {
    return (
      <Screen>
        <AppHeader title="Cookbook" />
        <EmptyState text="Sign in to save recipes to your personal cookbook." />
        <View style={styles.pad}>
          <Button label="Sign in" onPress={() => router.push('/login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Cookbook" />
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
        }
      >
        {loading && !recipes.length ? <LoadingBlock /> : null}
        {!loading && recipes.length === 0 ? (
          <EmptyState text="Tap the heart on any recipe to save it here." />
        ) : null}
        {recipes.map((r) => (
          <Pressable
            key={r.slug}
            style={styles.row}
            onPress={() => router.push(`/recipe/${r.slug}`)}
          >
            {(r.cover_image_path || r.cover_url) ? (
              <Image
                source={{ uri: r.cover_image_path || r.cover_url || '' }}
                style={styles.thumb}
              />
            ) : (
              <Text style={styles.emoji}>🥣</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.cat}>{r.category || 'Recipe'}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  emoji: { fontSize: 32, width: 56, textAlign: 'center' },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: colors.text },
  cat: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: colors.textSecondary },
});
