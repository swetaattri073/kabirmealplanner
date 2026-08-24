import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Card, EmptyState, Field, LoadingBlock, Screen } from '../src/components/ui';
import { colors, radii } from '../src/theme';

export default function GrowthScreen() {
  const { activeToddler } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeToddler) {
      setLoading(false);
      return;
    }
    try {
      setData(await api.growth(activeToddler.ref));
    } catch {
      setData(null);
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

  const onSave = async () => {
    if (!activeToddler) return;
    const w = weight.trim() ? parseFloat(weight) : null;
    const h = height.trim() ? parseFloat(height) : null;
    if (w == null && h == null) {
      Alert.alert('Enter a measurement', 'Add weight (kg) and/or height (cm).');
      return;
    }
    setSaving(true);
    try {
      await api.addGrowthRecord(activeToddler.ref, {
        weight_kg: w,
        height_cm: h,
      });
      setWeight('');
      setHeight('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const records = data?.records || [];
  const weightPoints = records.filter((r: any) => r.weight_kg != null);

  return (
    <Screen>
      <AppHeader title="Growth" />
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {loading ? <LoadingBlock /> : null}

        <Card>
          <Text style={styles.h}>Log measurement</Text>
          <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 8.2" />
          <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="e.g. 68" />
          <Button label="Save" onPress={onSave} loading={saving} />
        </Card>

        {weightPoints.length >= 2 ? (
          <Card>
            <Text style={styles.h}>Weight trend</Text>
            <MiniChart
              points={weightPoints.map((r: any, i: number) => ({
                x: i,
                y: r.weight_kg,
                label: r.recorded_at?.slice(5) || '',
              }))}
              bands={data?.bands?.weight?.slice(0, 24) || []}
            />
          </Card>
        ) : null}

        {records.length === 0 && !loading ? (
          <EmptyState text="Add your first weight or height to start tracking." />
        ) : null}

        {records.map((r: any) => (
          <Card key={r.id}>
            <Text style={styles.date}>{r.recorded_at}</Text>
            {r.weight_kg != null && (
              <Text style={styles.val}>
                Weight: {r.weight_kg} kg
                {r.weight_percentile ? ` (${r.weight_percentile.percentile}th %ile)` : ''}
              </Text>
            )}
            {r.height_cm != null && (
              <Text style={styles.val}>
                Height: {r.height_cm} cm
                {r.height_percentile ? ` (${r.height_percentile.percentile}th %ile)` : ''}
              </Text>
            )}
          </Card>
        ))}

        <Text style={styles.disclaimer}>
          {data?.disclaimer ||
            'For information only, not medical advice. Consult your pediatrician.'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function MiniChart({
  points,
  bands,
}: {
  points: { x: number; y: number; label: string }[];
  bands: { age_months: number; p3: number; p50: number; p97: number }[];
}) {
  const w = 300;
  const h = 140;
  const pad = 16;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys, ...(bands.length ? bands.map((b) => b.p3) : ys)) - 0.5;
  const maxY = Math.max(...ys, ...(bands.length ? bands.map((b) => b.p97) : ys)) + 0.5;
  const scaleX = (x: number) => pad + (x / Math.max(points.length - 1, 1)) * (w - pad * 2);
  const scaleY = (y: number) => h - pad - ((y - minY) / (maxY - minY || 1)) * (h - pad * 2);
  const line = points.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={w} height={h}>
        {bands.slice(0, points.length).map((b, i) => (
          <Line
            key={i}
            x1={scaleX(i)}
            x2={scaleX(i)}
            y1={scaleY(b.p97)}
            y2={scaleY(b.p3)}
            stroke="#c7d2fe"
            strokeWidth={8}
          />
        ))}
        <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={3} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  h: { fontFamily: 'Nunito_800ExtraBold', fontSize: 17, color: colors.text, marginBottom: 10 },
  date: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.text },
  val: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 24,
  },
});
