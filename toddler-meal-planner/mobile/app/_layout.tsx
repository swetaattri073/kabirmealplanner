import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/AuthContext';
import { StartupGate } from '../src/StartupGate';
import { colors } from '../src/theme';
import { loadNotifyPrefs, initMealReminderSync, rescheduleMealReminders } from '../src/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useKeepAwake();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      initMealReminderSync();
      const t = setTimeout(() => {
        loadNotifyPrefs()
          .then((p) => {
            if (p.notificationsPrompted && p.enabled) {
              rescheduleMealReminders(p).catch(() => undefined);
            }
          })
          .catch(() => undefined);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StartupGate fontsLoaded={fontsLoaded} />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
