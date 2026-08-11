import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  FadeInDown,
  FadeInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

/**
 * Colors / angles match toddler-meal-planner/templates/landing.html
 * .slide-bg / .alt-a / .alt-b / .alt-c / .alt-d
 */
type Slide = {
  key: string;
  kind: 'hero' | 'post';
  colors: [string, string, ...string[]];
  locations: number[];
  /** Approximate CSS angle → LinearGradient start/end */
  start: { x: number; y: number };
  end: { x: number; y: number };
  kicker?: string;
  emoji?: string;
  title: string;
  titleHi?: string;
  body: string;
  solution?: string;
};

const SLIDES: Slide[] = [
  {
    key: 'hero',
    kind: 'hero',
    // linear-gradient(145deg, #6366f1 0%, #8b5cf6 35%, #ec4899 70%, #f97316 100%)
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
    // alt-a: 160deg #312e81 → #7c3aed → #db2777
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
    key: 'plan',
    kind: 'post',
    // alt-b: 160deg #0f766e → #2563eb → #7c3aed
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
    // alt-c: 160deg #9a3412 → #ea580c → #db2777
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
    // alt-d: 160deg #1e3a8a → #4f46e5 → #06b6d4
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
  // Web MaskedView is unreliable — use amber that matches .hi gradient midpoint.
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

function ProgressBars({ index, count }: { index: number; count: number }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: count }).map((_, i) => (
        <ProgressSeg key={i} filled={i <= index} active={i === index} />
      ))}
    </View>
  );
}

function ProgressSeg({ filled, active }: { filled: boolean; active: boolean }) {
  const progress = useSharedValue(filled ? 1 : 0);
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, {
      duration: active ? 280 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [filled, active, progress]);
  const style = useAnimatedStyle(() => ({
    width: trackW * progress.value,
  }));
  return (
    <View
      style={styles.bar}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.barFill, style]} />
    </View>
  );
}

function FloatingMark() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, -10]) }],
  }));
  return (
    <Animated.View style={[styles.heroMarkWrap, style]}>
      <Image
        source={require('../assets/littlebowl-mark.png')}
        style={styles.heroMark}
        accessibilityLabel="LittleBowl"
      />
    </Animated.View>
  );
}

function NudgeHint() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [0, 6]) }],
    opacity: interpolate(t.value, [0, 0.5, 1], [0.75, 1, 0.75]),
  }));
  return (
    <Animated.Text style={[styles.swipeHint, style]}>
      Swipe for more  →
    </Animated.Text>
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

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Exact full-bleed slide gradients (no dark vignette tinting) */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[StyleSheet.absoluteFill, { opacity: i === index ? 1 : 0 }]}
          >
            <LinearGradient
              colors={slide.colors}
              locations={slide.locations}
              start={slide.start}
              end={slide.end}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </View>

      <View style={{ paddingTop: Math.max(insets.top, 10) + 4, zIndex: 2 }}>
        <ProgressBars index={index} count={SLIDES.length} />
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

      {/* Swipe carousel — same horizontal story track as web */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        style={{ flex: 1, zIndex: 1 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {item.kind === 'hero' ? (
              <Animated.View
                entering={FadeInDown.duration(480).springify().damping(15)}
                style={styles.heroInner}
              >
                <FloatingMark />
                <Text style={styles.heroTitle}>{item.title}</Text>
                {item.titleHi ? <GradientHi text={item.titleHi} /> : null}
                <Text style={styles.heroSub}>{item.body}</Text>
                <NudgeHint />
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInRight.delay(30).duration(420).springify().damping(15)}
                style={styles.postCard}
              >
                {item.kicker ? <Text style={styles.kicker}>{item.kicker}</Text> : null}
                {item.emoji ? <Text style={styles.emoji}>{item.emoji}</Text> : null}
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                {item.solution ? (
                  <View style={styles.solution}>
                    <Text style={styles.solutionIcon}>✓</Text>
                    <Text style={styles.solutionText}>{item.solution}</Text>
                  </View>
                ) : null}
              </Animated.View>
            )}
          </View>
        )}
      />

      <View
        style={[
          styles.cta,
          { paddingBottom: Math.max(insets.bottom, 14), zIndex: 4 },
        ]}
      >
        {index === 0 || isLast ? (
          <>
            <PillButton
              label="Create account"
              onPress={() => router.push('/register')}
            />
            <PillButton
              label="Sign in"
              variant="ghost"
              onPress={() => router.push('/login')}
            />
            {isLast ? (
              <PillButton
                label="Continue without an account"
                variant="guest"
                onPress={() => router.push('/onboarding')}
              />
            ) : (
              <PillButton
                label="Continue as guest"
                variant="guest"
                onPress={() => router.push('/onboarding')}
              />
            )}
          </>
        ) : (
          <PillButton label="Next" onPress={() => go(index + 1)} />
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
  slide: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  heroInner: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  heroMarkWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
  },
  heroMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fffaf0',
  },
  heroTitle: {
    color: '#fff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTitleHiMask: {
    marginTop: 2,
    marginBottom: 12,
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
    marginBottom: 18,
  },
  swipeHint: {
    color: 'rgba(255,255,255,0.9)',
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
