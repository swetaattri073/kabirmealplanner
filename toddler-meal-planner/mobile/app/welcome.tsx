import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radii } from '../src/theme';
import { Button } from '../src/components/ui';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'hero',
    title: 'End mealtime battles',
    body: 'Personalized plans for Indian toddlers — what they accept, what they need.',
  },
  {
    key: 'learn',
    title: 'Learns what works',
    body: 'Log meals and reactions. LittleBowl suggests foods that stick.',
  },
  {
    key: 'nutrition',
    title: 'Nutrition you can see',
    body: 'Daily targets for iron, calcium, protein, and more — without the stress.',
  },
  {
    key: 'plan',
    title: 'Weekly plans ready',
    body: 'Breakfast through dinner, adapted to age, allergies, and preferences.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.root}>
      <View style={styles.progress}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={styles.bar}>
            <View style={[styles.barFill, i <= index && { width: '100%' }]} />
          </View>
        ))}
      </View>

      <View style={styles.top}>
        <Image source={require('../assets/littlebowl-mark.png')} style={styles.mark} />
        <Text style={styles.brand}>
          <Text style={{ color: '#e8f5c8' }}>Little</Text>
          <Text style={{ color: '#ffd4a8' }}>Bowl</Text>
        </Text>
        <Pressable onPress={() => router.push('/login')}>
          <Text style={styles.signInLink}>Sign in</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.cta}>
        {index === 0 ? (
          <>
            <Button label="Create account" onPress={() => router.push('/register')} />
            <Button label="Sign in" variant="ghost" onPress={() => router.push('/login')} />
            <Button
              label="Continue as guest"
              variant="secondary"
              onPress={() => router.push('/onboarding')}
            />
          </>
        ) : isLast ? (
          <>
            <Button label="Create account" onPress={() => router.push('/register')} />
            <Button
              label="Set up toddler profile"
              variant="secondary"
              onPress={() => router.push('/onboarding')}
            />
          </>
        ) : (
          <Button
            label="Next"
            onPress={() =>
              listRef.current?.scrollToIndex({ index: index + 1, animated: true })
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.storyBg,
    paddingBottom: 28,
  },
  progress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 56,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    width: 0,
    backgroundColor: '#fff',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  mark: { width: 36, height: 36 },
  brand: {
    flex: 1,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
  },
  signInLink: {
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
    opacity: 0.9,
  },
  slide: {
    width,
    paddingHorizontal: 28,
    paddingTop: 48,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 16,
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Nunito_400Regular',
    fontSize: 17,
    lineHeight: 26,
  },
  cta: {
    paddingHorizontal: 20,
    gap: 4,
  },
});
