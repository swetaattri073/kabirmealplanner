import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import {
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  Screen,
} from '../../src/components/ui';
import { colors, MEAL_LABELS, radii, REACTIONS } from '../../src/theme';
import type { Food } from '../../src/types';

export default function LogMealScreen() {
  const { activeToddler } = useAuth();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [mealType, setMealType] = useState(params.meal || 'breakfast');
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [reaction, setReaction] = useState<string>('liked');
  const [nlp, setNlp] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.meal) setMealType(String(params.meal));
  }, [params.meal]);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setFoods([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.foods(q.trim());
      setFoods(Array.isArray(data) ? data.slice(0, 20) : (data.foods || []).slice(0, 20));
    } catch {
      setFoods([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const save = async () => {
    if (!activeToddler) return;
    if (!selected) {
      Alert.alert('Pick a food');
      return;
    }
    setSaving(true);
    try {
      await api.createMealLog({
        toddler_id: activeToddler.ref,
        meal_type: mealType,
        food_id: selected.id,
        toddler_reaction: reaction,
        portion_eaten_percent: reaction === 'refused' ? 0 : 100,
        replace_existing: true,
      });
      Alert.alert('Logged', `${selected.name} saved for ${MEAL_LABELS[mealType] || mealType}`);
      setSelected(null);
      setQuery('');
      setFoods([]);
    } catch (e: any) {
      Alert.alert('Could not log', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const smartLog = async () => {
    if (!activeToddler || !nlp.trim()) return;
    setSaving(true);
    try {
      await api.smartLog({ toddler_id: activeToddler.ref, text: nlp.trim() });
      Alert.alert('Logged', 'Meal parsed and saved.');
      setNlp('');
    } catch (e: any) {
      Alert.alert('Smart log failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const photoLog = async () => {
    if (!activeToddler) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });
    if (shot.canceled || !shot.assets?.[0]) return;
    setLoading(true);
    try {
      const asset = shot.assets[0];
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: 'meal.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);
      form.append('toddler_id', activeToddler.ref);
      const result = await api.recognizeFood(form);
      Alert.alert(
        'Photo analyzed',
        result?.message ||
          result?.foods?.map((f: any) => f.name).join(', ') ||
          'Review suggestions on the server response.',
      );
    } catch (e: any) {
      Alert.alert('Photo log unavailable', e?.message || 'Try typing the meal instead.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeToddler) {
    return (
      <Screen>
        <AppHeader title="Log meal" />
        <EmptyState text="Create a toddler profile first." />
      </Screen>
    );
  }

  const mealTypes = Object.keys(MEAL_LABELS);

  return (
    <Screen>
      <AppHeader title="Log meal" />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Meal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {mealTypes.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMealType(m)}
              style={[styles.chip, mealType === m && styles.chipOn]}
            >
              <Text style={[styles.chipText, mealType === m && styles.chipTextOn]}>
                {MEAL_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Card>
          <Field
            label="Search food"
            value={query}
            onChangeText={search}
            placeholder="e.g. idli, dal, banana"
          />
          {searching ? <LoadingBlock /> : null}
          {foods.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.foodRow, selected?.id === f.id && styles.foodOn]}
              onPress={() => setSelected(f)}
            >
              <Text style={styles.foodName}>{f.name}</Text>
              <Text style={styles.foodMeta}>{f.category}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>Reaction</Text>
          <View style={styles.row}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReaction(r.id)}
                style={[styles.chip, reaction === r.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, reaction === r.id && styles.chipTextOn]}>
                  {r.emoji} {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label="Save meal" onPress={save} loading={saving} />
        </Card>

        <Card>
          <Field
            label="Or describe the meal"
            value={nlp}
            onChangeText={setNlp}
            placeholder="Had rice and dal for lunch, ate half, liked it"
            multiline
          />
          <Button label="Smart log" variant="secondary" onPress={smartLog} loading={saving} />
          <Button label="Photo log" variant="ghost" onPress={photoLog} loading={loading} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  label: {
    fontFamily: 'Nunito_700Bold',
    color: colors.text,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    marginRight: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13 },
  chipTextOn: { color: colors.white },
  foodRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  foodOn: { backgroundColor: colors.bgTertiary },
  foodName: { fontFamily: 'Nunito_700Bold', color: colors.text },
  foodMeta: { fontFamily: 'Nunito_400Regular', color: colors.textSecondary, fontSize: 12 },
});
