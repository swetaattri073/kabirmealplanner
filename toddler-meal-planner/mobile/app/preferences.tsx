import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../src/components/ui';
import { colors } from '../src/theme';

export default function PreferencesScreen() {
  const { activeToddler } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.preferences(activeToddler.ref);
      setData(d);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeToddler]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (!activeToddler) {
    return (
      <Screen>
        <AppHeader title="Preferences" />
        <EmptyState text="Add a toddler to track preferences." />
      </Screen>
    );
  }

  const buckets: Array<[string, any[]]> = [
    ['Loved / liked', data?.liked || []],
    ['Exploring', data?.neutral || []],
    ['Disliked / avoid', data?.disliked || []],
  ];

  return (
    <Screen>
      <AppHeader title="Preferences" />
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {buckets.map(([title, items]) => (
            <Card key={title}>
              <Text style={styles.h}>{title}</Text>
              {(items || []).length ? (
                items.map((p: any, i: number) => (
                  <View key={p.id || i} style={styles.row}>
                    <Text style={styles.name}>{p.food?.name || p.name || 'Food'}</Text>
                    <Text style={styles.meta}>
                      {p.last_reaction || p.display_bucket || ''}
                      {p.times_offered != null ? ` · ${p.times_offered}x` : ''}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.meta}>Nothing here yet — keep logging meals.</Text>
              )}
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: { fontFamily: 'Nunito_700Bold', color: colors.text },
  meta: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 12 },
});
