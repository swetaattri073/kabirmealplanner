import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

const FAB_SIZE = 58;
/** Gap between FAB bottom edge and top of tab bar icons. */
const FAB_TAB_GAP = 14;
/** Tab bar content height — keep in sync with (tabs)/_layout.tsx */
const TAB_BAR_CONTENT_HEIGHT = 56;

/** Floating chat launcher — hidden on the chat screen itself. */
export function ChatFab() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const fabBottom = TAB_BAR_CONTENT_HEIGHT + bottomPad + FAB_TAB_GAP;
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.45);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1.55, { duration: 1400, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(0.35, { duration: 0 })),
        withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [ringOpacity, ringScale, scale]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  if (pathname === '/chat' || pathname.endsWith('/chat')) {
    return null;
  }

  return (
    <View style={[styles.host, { bottom: fabBottom }]} pointerEvents="box-none">
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={fabStyle}>
        <Pressable
          onPress={() => router.push('/chat')}
          accessibilityRole="button"
          accessibilityLabel="Ask LittleBowl — open chat assistant"
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={['#6366f1', '#8b5cf6'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Text style={styles.emoji}>💬</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 18,
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  ring: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
  },
  pressable: {
    borderRadius: FAB_SIZE / 2,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  pressed: { opacity: 0.92 },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  emoji: { fontSize: 26 },
});
