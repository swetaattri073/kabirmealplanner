import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SharedValue,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const STORY_MS = 5200;

type Slide = {
  key: string;
  kind: 'hero' | 'post';
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
  kicker?: string;
  emoji?: string;
  title: string;
  titleHi?: string;
  body: string;
  solution?: string;
};

/** Colors match toddler-meal-planner/templates/landing.html */
const SLIDES: Slide[] = [
  {
    key: 'hero',
    kind: 'hero',
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f97316'],
    locations: [0, 0.35, 0.7, 1],
    start: { x: 0.15, y: 0 },
    end: { x: 0.85, y: 1 },
    title: 'Mealtime battles',
    titleHi: 'end here.',
    body: 'Personalized Indian toddler meals your picky eater will actually finish — with nutrition tracking that parents trust.',
  },
  {
    key: 'pain',
    kind: 'post',
    colors: ['#312e81', '#7c3aed', '#db2777'],
    locations: [0, 0.45, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    kicker: '♥  We get it',
    emoji: '😫',
    title: '“Not this again!”',
    body: 'Plate pushed away before the first bite. You’ve already cooked three things and it’s still breakfast.',
    solution: 'LittleBowl learns what they accept and suggests meals that stick.',
  },
  {
    key: 'solids',
    kind: 'post',
    colors: ['#c2410c', '#ea580c', '#fbbf24'],
    locations: [0, 0.5, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    kicker: '🥄  Starting solids',
    emoji: '🥄',
    title: 'Starting solids at 6 months',
    body: 'First tastes, textures, and allergen guidance — one new food at a time, Indian home foods first.',
    solution: 'A step-by-step weaning guide built into your plan.',
  },
  {
    key: 'plan',
    kind: 'post',
    colors: ['#0f766e', '#2563eb', '#7c3aed'],
    locations: [0, 0.5, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    kicker: '📅  Weekly plans',
    emoji: '📅',
    title: '“What do I make today?”',
    body: 'Stop reinventing lunch every afternoon. Get a 7-day plan tuned to Indian home cooking.',
    solution: 'Auto-generated weekly plans based on age, diet, and likes.',
  },
  {
    key: 'nutrition',
    kind: 'post',
    colors: ['#9a3412', '#ea580c', '#db2777'],
    locations: [0, 0.4, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    kicker: '📊  Nutrition',
    emoji: '⚠️',
    title: '“Are they getting enough?”',
    body: 'Iron, protein, calcium — track gaps without spreadsheets, and get gentle meal reminders.',
    solution: 'Daily nutrition score + alerts when something looks low.',
  },
  {
    key: 'foods',
    kind: 'post',
    colors: ['#1e3a8a', '#4f46e5', '#06b6d4'],
    locations: [0, 0.5, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    kicker: '🍛  Indian foods',
    emoji: '🍛',
    title: 'Khichdi to idli, covered',
    body: '100+ familiar recipes — dal, roti sabzi, dosa, porridge — adapted for little bowls.',
    solution: 'Built for Indian families, not translated Western menus.',
  },
];

function GradientHi({ text }: { text: string }) {
  if (Platform.OS === 'web') {
    return <Text style={[styles.heroTitle, styles.heroTitleHiFallback]}>{text}</Text>;
  }
  return (
    <MaskedView
      style={{ alignSelf: 'center', marginTop: 2, marginBottom: 12 }}
      maskElement={
        <Text style={[styles.heroTitle, { backgroundColor: 'transparent' }]}>{text}</Text>
      }
    >
      <LinearGradient
        colors={['#fbbf24', '#f97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ alignItems: 'center' }}
      >
        <Text style={[styles.heroTitle, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function StoryProgress({
  index,
  count,
  fill,
}: {
  index: number;
  count: number;
  fill: SharedValue<number>;
}) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: count }).map((_, i) => (
        <StorySeg key={i} state={i < index ? 'done' : i === index ? 'active' : 'todo'} fill={fill} />
      ))}
    </View>
  );
}

function StorySeg({
  state,
  fill,
}: {
  state: 'done' | 'active' | 'todo';
  fill: SharedValue<number>;
}) {
  const [trackW, setTrackW] = useState(0);
  const style = useAnimatedStyle(() => {
    const p = state === 'done' ? 1 : state === 'active' ? fill.value : 0;
    return { width: trackW * p };
  });
  return (
    <View style={styles.bar} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.barFill, style]} />
    </View>
  );
}

const ORBIT_FOODS = ['🥕', '🍎', '🥦', '🍌', '🍚', '🧀'] as const;
const ORBIT_RADIUS = Math.min(width * 0.28, 108);
const ORBIT_SIZE = Math.min(width * 0.72, 260);

function OrbitFood({
  emoji,
  index,
  total,
  spin,
}: {
  emoji: string;
  index: number;
  total: number;
  spin: SharedValue<number>;
}) {
  const phase = (index / total) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const angle = spin.value * Math.PI * 2 + phase;
    const deg = (angle * 180) / Math.PI;
    return {
      transform: [
        { rotate: `${deg}deg` },
        { translateX: ORBIT_RADIUS },
        { rotate: `${-deg}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.orbitFood, style]}>
      <Text style={styles.orbitFoodEmoji}>{emoji}</Text>
    </Animated.View>
  );
}

function OrbitingMealsHero() {
  const spin = useSharedValue(0);
  const bob = useSharedValue(0);
  const foodBounce = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    foodBounce.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [spin, bob, foodBounce]);

  const plateStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -12]) },
      { rotate: `${interpolate(bob.value, [0, 1], [-2, 2])}deg` },
    ],
  }));
  const centerFoodStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(foodBounce.value, [0, 1], [1, 1.08]) }],
  }));

  return (
    <View style={styles.orbitScene} accessibilityLabel="Toddler with meals orbiting">
      {ORBIT_FOODS.map((emoji, i) => (
        <OrbitFood key={emoji} emoji={emoji} index={i} total={ORBIT_FOODS.length} spin={spin} />
      ))}
      <Animated.View style={[styles.orbitPlate, plateStyle]}>
        <View style={styles.orbitPlateRing} />
        <Animated.View style={centerFoodStyle}>
          <Image
            source={require('../assets/littlebowl-mark.png')}
            style={styles.orbitToddler}
            accessibilityLabel="LittleBowl toddler"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function PillButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'guest';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' && styles.pillPrimary,
        variant === 'ghost' && styles.pillGhost,
        variant === 'guest' && styles.pillGuest,
        pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          variant === 'primary' && styles.pillTextPrimary,
          variant === 'ghost' && styles.pillTextGhost,
          variant === 'guest' && styles.pillTextGuest,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  if (slide.kind === 'hero') {
    return (
      <Animated.View
        key={slide.key}
        entering={FadeInDown.duration(480).springify().damping(15)}
        style={styles.heroInner}
      >
        <OrbitingMealsHero />
        <Text style={styles.heroTitle}>{slide.title}</Text>
        {slide.titleHi ? <GradientHi text={slide.titleHi} /> : null}
        <Text style={styles.heroSub}>{slide.body}</Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      key={slide.key}
      entering={FadeInDown.duration(420).springify().damping(15)}
      style={styles.postCard}
    >
      {slide.kicker ? <Text style={styles.kicker}>{slide.kicker}</Text> : null}
      {slide.emoji ? <Text style={styles.emoji}>{slide.emoji}</Text> : null}
      <Text style={styles.cardTitle}>{slide.title}</Text>
      <Text style={styles.cardBody}>{slide.body}</Text>
      {slide.solution ? (
        <View style={styles.solution}>
          <Text style={styles.solutionIcon}>✓</Text>
          <Text style={styles.solutionText}>{slide.solution}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const fill = useSharedValue(0);
  const bgFade = useSharedValue(1);

  const go = useCallback(
    (next: number) => {
      const i = ((next % SLIDES.length) + SLIDES.length) % SLIDES.length;
      cancelAnimation(fill);
      fill.value = 0;
      bgFade.value = 0;
      bgFade.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      setIndex(i);
    },
    [fill, bgFade],
  );

  const advance = useCallback(() => {
    go(index + 1);
  }, [go, index]);

  // Instagram-style timed progress → smooth auto-advance (no swipe)
  useEffect(() => {
    cancelAnimation(fill);
    fill.value = 0;
    fill.value = withTiming(
      1,
      { duration: STORY_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(advance)();
      },
    );
    return () => cancelAnimation(fill);
  }, [index, fill, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
  }, [go, index]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgFade.value,
  }));

  const slide = SLIDES[index];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Crossfading backgrounds */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        {SLIDES.map((s, i) =>
          i === index ? (
            <Animated.View key={s.key} style={[StyleSheet.absoluteFill, bgStyle]}>
              <LinearGradient
                colors={s.colors}
                locations={s.locations}
                start={s.start}
                end={s.end}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null,
        )}
        {/* Keep previous color under fade to avoid black flash */}
        <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
          <LinearGradient
            colors={slide.colors}
            locations={slide.locations}
            start={slide.start}
            end={slide.end}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      <View style={{ paddingTop: Math.max(insets.top, 10) + 4, zIndex: 2 }}>
        <StoryProgress index={index} count={SLIDES.length} fill={fill} />
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
      </View>

      {/* Tap zones: left = previous, right = next — no swipe */}
      <View style={styles.stage}>
        <Pressable
          style={styles.tapLeft}
          onPress={() => go(index - 1)}
          accessibilityLabel="Previous story"
        />
        <Pressable
          style={styles.tapRight}
          onPress={() => go(index + 1)}
          accessibilityLabel="Next story"
        />
        <View style={styles.stageContent} pointerEvents="box-none">
          <Animated.View
            key={slide.key}
            entering={FadeIn.duration(380)}
            style={styles.slide}
          >
            <SlideBody slide={slide} />
          </Animated.View>
        </View>
      </View>

      {/* Always-visible CTAs */}
      <View
        style={[
          styles.cta,
          { paddingBottom: Math.max(insets.bottom, 14), zIndex: 4 },
        ]}
      >
        <PillButton label="Create account" onPress={() => router.push('/register')} />
        <PillButton label="Sign in" variant="ghost" onPress={() => router.push('/login')} />
        <PillButton
          label="Continue as guest"
          variant="guest"
          onPress={() => router.push('/onboarding')}
        />
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
    backgroundColor: '#fff',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
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
  stage: {
    flex: 1,
    zIndex: 1,
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '35%',
    zIndex: 3,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '35%',
    zIndex: 3,
  },
  stageContent: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 2,
  },
  slide: {
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  heroInner: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  orbitScene: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  orbitPlate: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
    zIndex: 2,
  },
  orbitPlateRing: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#e9d5ff',
    borderStyle: 'dashed',
  },
  orbitToddler: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#fffaf0',
  },
  orbitFood: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginTop: -22,
    marginLeft: -22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  orbitFoodEmoji: {
    fontSize: 34,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 10,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTitleHiFallback: {
    marginTop: 2,
    marginBottom: 12,
    color: '#fbbf24',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 340,
  },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  kicker: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    lineHeight: 32,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  cardBody: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  solution: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  solutionIcon: {
    color: '#bbf7d0',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    marginTop: 1,
  },
  solutionText: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    paddingHorizontal: 20,
    gap: 10,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPrimary: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  pillGhost: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  pillGuest: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  pillText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
  },
  pillTextPrimary: {
    color: '#4f46e5',
  },
  pillTextGhost: {
    color: '#fff',
  },
  pillTextGuest: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
  },
});
