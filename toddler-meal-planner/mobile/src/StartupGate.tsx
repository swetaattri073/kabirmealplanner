import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from './AuthContext';

/** Hide the native splash only once fonts (parent) and auth session are ready. */
export function StartupGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready } = useAuth();

  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, ready]);

  return null;
}
