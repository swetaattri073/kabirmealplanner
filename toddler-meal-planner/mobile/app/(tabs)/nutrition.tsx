import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, LoadingBlock, Screen } from '../../src/components/ui';
import { colors, radii } from '../../src/theme';

export default function NutritionScreen() {
  const { activeToddler } = useAuth();
  const [daily, setDaily] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      const [d, a] = await Promise.all([
        api.nutritionDaily(activeToddler.ref),
        api.nutritionAlerts(activeToddler.ref),
      ]);
      setDaily(d);
      setAlerts(a.alerts || a || []);
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
        <AppHeader title="Nutrition" />
        <EmptyState text="Add a toddler to track nutrition." />
      </Screen>
    );
  }

  const nutrients = Object.entries(daily?.nutrients || daily?.status?.nutrients || {});

  return (
    <Screen>
      <AppHeader title="Nutrition" />
      {loading && !daily ? (
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
          <Card>
            <Text style={styles.h}>Today</Text>
            {nutrients.map(([key, n]: any) => {
              const pct = Math.min(100, Math.round(n.percent || 0));
              return (
                <View key={key} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name}>{n.name || key}</Text>
                    <Text style={styles.pct}>{pct}%</Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.meta}>
                    {n.consumed ?? 0}
                    {n.unit || ''} / {n.target ?? '—'}
                    {n.unit || ''}
                  </Text>
                </View>
              );
            })}
            {!nutrients.length ? <EmptyState text="No nutrition data yet — log a meal." /> : null}
          </Card>

          <Card>
            <Text style={styles.h}>Alerts</Text>
            {alerts.length ? (
              alerts.map((a, i) => (
                <Text key={i} style={styles.alert}>
                  {a.message || JSON.stringify(a)}
                </Text>
              ))
            ) : (
              <Text style={styles.meta}>No alerts right now.</Text>
            )}
          </Card>
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
    marginBottom: 12,
  },
  row: { marginBottom: 14 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontFamily: 'Nunito_700Bold', color: colors.text },
  pct: { fontFamily: 'Nunito_800ExtraBold', color: colors.primary },
  bar: {
    height: 10,
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.primary },
  meta: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  alert: { fontFamily: 'Nunito_400Regular', color: colors.text, marginBottom: 8 },
});
