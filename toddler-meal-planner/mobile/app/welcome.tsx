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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui';

const { width, height } = Dimensions.get('window');

type Slide = {
  key: string;
  title: string;
  body: string;
  kicker?: string;
  /** Matches web landing .slide-bg / .alt-* gradients */
  colors: [string, string, ...string[]];
  locations?: number[];
  card?: boolean;
};

const SLIDES: Slide[] = [
  {
    key: 'hero',
    title: 'End mealtime battles',
    body: 'Personalized plans for Indian toddlers — what they accept, what they need.',
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f97316'],
    locations: [0, 0.35, 0.7, 1],
  },
  {
    key: 'learn',
    title: 'Learns what works',
    body: 'Log meals and reactions. LittleBowl suggests foods that stick.',
    kicker: 'We get it',
    colors: ['#312e81', '#7c3aed', '#db2777'],
    locations: [0, 0.45, 1],
    card: true,
  },
  {
    key: 'nutrition',
    title: 'Nutrition you can see',
    body: 'Daily targets for iron, calcium, protein, and more — without the stress.',
    kicker: 'Nutrition',
    colors: ['#9a3412', '#ea580c', '#db2777'],
    locations: [0, 0.4, 1],
    card: true,
  },
  {
    key: 'plan',
    title: 'Weekly plans ready',
    body: 'Breakfast through dinner, adapted to age, allergies, and preferences.',
    kicker: 'Weekly plans',
    colors: ['#1e3a8a', '#4f46e5', '#06b6d4'],
    locations: [0, 0.5, 1],
    card: true,
  },
];

function SlideAtmosphere({ slideIndex }: { slideIndex: number }) {
  // Soft orbs — same role as web slide depth (no flat single color)
  const variants = [
    [
      { top: '8%', left: '-18%', size: width * 0.72, color: 'rgba(255,255,255,0.16)' },
      { top: '42%', right: '-22%', size: width * 0.8, color: 'rgba(249,115,22,0.28)' },
      { bottom: '6%', left: '10%', size: width * 0.45, color: 'rgba(236,72,153,0.22)' },
    ],
    [
      { top: '12%', right: '-16%', size: width * 0.65, color: 'rgba(255,255,255,0.12)' },
      { bottom: '18%', left: '-20%', size: width * 0.7, color: 'rgba(124,58,237,0.35)' },
    ],
    [
      { top: '18%', left: '-12%', size: width * 0.6, color: 'rgba(255,255,255,0.14)' },
      { bottom: '10%', right: '-18%', size: width * 0.75, color: 'rgba(234,88,12,0.3)' },
    ],
    [
      { top: '10%', left: '20%', size: width * 0.55, color: 'rgba(6,182,212,0.25)' },
      { bottom: '15%', right: '-15%', size: width * 0.7, color: 'rgba(255,255,255,0.12)' },
    ],
  ];
  const orbs = variants[slideIndex % variants.length];
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {orbs.map((orb, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: (orb as any).top,
            left: (orb as any).left,
            right: (orb as any).right,
            bottom: (orb as any).bottom,
            width: orb.size,
            height: orb.size,
            borderRadius: orb.size / 2,
            backgroundColor: orb.color,
          }}
        />
      ))}
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Full-bleed slide backgrounds sit under chrome */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[
              StyleSheet.absoluteFill,
              { opacity: i === index ? 1 : 0 },
            ]}
          >
            <LinearGradient
              colors={slide.colors}
              locations={slide.locations}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SlideAtmosphere slideIndex={i} />
            {/* Bottom vignette so CTAs stay readable */}
            <LinearGradient
              colors={['transparent', 'rgba(15,18,34,0.35)', 'rgba(15,18,34,0.55)']}
              locations={[0.45, 0.75, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </View>

      <View style={[styles.progress, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
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
        <Pressable onPress={() => router.push('/login')} hitSlop={12}>
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
        style={{ flex: 1 }}
        renderItem={({ item, index: i }) => (
          <View style={[styles.slide, { width }]}>
            {i === 0 ? (
              <View style={styles.heroInner}>
                <View style={styles.heroMarkWrap}>
                  <Image
                    source={require('../assets/littlebowl-mark.png')}
                    style={styles.heroMark}
                    accessibilityLabel="LittleBowl"
                  />
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.swipeHint}>Swipe for more →</Text>
              </View>
            ) : (
              <View style={styles.postCard}>
                {item.kicker ? (
                  <Text style={styles.kicker}>{item.kicker}</Text>
                ) : null}
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.cta}>
        {index === 0 ? (
          <>
            <Button label="Create account" onPress={() => router.push('/register')} />
            <Pressable
              onPress={() => router.push('/login')}
              style={({ pressed }) => [styles.ghostOnDark, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ghostOnDarkText}>Sign in</Text>
            </Pressable>
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
    backgroundColor: '#0f1222',
  },
  progress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    zIndex: 2,
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
    zIndex: 2,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fffaf0',
  },
  brand: {
    flex: 1,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
  },
  signInLink: {
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
    opacity: 0.92,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: Math.min(height * 0.48, 420),
  },
  heroInner: {
    alignItems: 'flex-start',
  },
  heroMarkWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroMark: { width: 64, height: 64, borderRadius: 32 },
  title: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 14,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Nunito_400Regular',
    fontSize: 17,
    lineHeight: 26,
  },
  swipeHint: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
  },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  kicker: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 12,
  },
  cardBody: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  cta: {
    paddingHorizontal: 20,
    gap: 4,
    zIndex: 2,
  },
  ghostOnDark: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  ghostOnDarkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: '#fff',
  },
});
